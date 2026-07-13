import { useEffect, useRef } from 'react'
import { resolveTokens, useTicker } from 'modulato'
import tokens from './motion'

/**
 * Full-viewport background, two WebGL2 passes:
 *
 *   1. A circular array of 3D cubes — raymarched with a directional light,
 *      soft shadows and ambient occlusion, warm-shadow tinting, depth fading
 *      to the white page — rendered into a framebuffer texture.
 *   2. Paper Shaders' HalftoneCmyk fragment shader, VERBATIM, with u_image
 *      pointed at that live texture: real CMYK plate separation, rotated dot
 *      screens (C 15deg / M 75deg / Y 0 / K 45deg), grain.
 *
 * The HalftoneCmyk GLSL is (c) Paper Design, github.com/paper-design/shaders,
 * Apache-2.0. Their React component only accepts a static image, so feeding
 * it a live scene means mounting the shader ourselves.
 *
 * Runs on the framework ticker; `scene` and `print` tokens tweak live.
 */
export function Scene() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const renderRef = useRef<(timeMs: number) => void>(() => {})

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false })
    if (!gl) return

    const sceneProg = buildProgram(gl, VERT, SCENE_FRAG)
    const paperProg = buildProgram(gl, VERT, PAPER_FRAG)
    if (!sceneProg || !paperProg) return

    // Fullscreen triangle shared by both passes
    const buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const bindQuad = (prog: WebGLProgram) => {
      const position = gl.getAttribLocation(prog, 'a_position')
      gl.enableVertexAttribArray(position)
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)
    }

    const u = (prog: WebGLProgram, name: string) => gl.getUniformLocation(prog, name)

    // Static random texture for the halftone grid jitter (their randomRG)
    const noise = new Uint8Array(256 * 256 * 4)
    let seed = 1
    for (let i = 0; i < noise.length; i++) {
      seed = (seed * 16807) % 2147483647
      noise[i] = seed % 256
    }
    const noiseTex = gl.createTexture()
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, noiseTex)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 256, 0, gl.RGBA, gl.UNSIGNED_BYTE, noise)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT)

    // Scene render target — pass 1 draws here, pass 2 reads it as u_image
    const sceneTex = gl.createTexture()
    const fbo = gl.createFramebuffer()
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const resize = () => {
      canvas.width = Math.round(canvas.clientWidth * dpr)
      canvas.height = Math.round(canvas.clientHeight * dpr)
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, sceneTex)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, canvas.width, canvas.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, sceneTex, 0)
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    }
    resize()
    window.addEventListener('resize', resize)

    const rgba = (hex: string): [number, number, number, number] => [
      parseInt(hex.slice(1, 3), 16) / 255,
      parseInt(hex.slice(3, 5), 16) / 255,
      parseInt(hex.slice(5, 7), 16) / 255,
      1,
    ]

    renderRef.current = (timeMs) => {
      const t = resolveTokens(tokens)
      const { speed, radius, size, count, camHeight, camDist, bandY, centerFocus, clear } = t.scene
      const print = t.print

      // Pass 1: the 3D scene into the framebuffer
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
      gl.viewport(0, 0, canvas.width, canvas.height)
      gl.useProgram(sceneProg)
      bindQuad(sceneProg)
      gl.uniform2f(u(sceneProg, 'u_resolution'), canvas.width, canvas.height)
      gl.uniform1f(u(sceneProg, 'u_time'), (timeMs / 1000) * speed)
      gl.uniform3f(u(sceneProg, 'u_ring'), radius, size, count)
      gl.uniform2f(u(sceneProg, 'u_cam'), camHeight, camDist)
      gl.uniform1f(u(sceneProg, 'u_band'), bandY)
      gl.uniform1f(u(sceneProg, 'u_focus'), centerFocus)
      gl.uniform1f(u(sceneProg, 'u_clear'), clear)
      gl.drawArrays(gl.TRIANGLES, 0, 3)

      // Pass 2: Paper's HalftoneCmyk over it
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      gl.viewport(0, 0, canvas.width, canvas.height)
      gl.useProgram(paperProg)
      bindQuad(paperProg)
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, sceneTex)
      gl.uniform1i(u(paperProg, 'u_image'), 0)
      gl.activeTexture(gl.TEXTURE1)
      gl.bindTexture(gl.TEXTURE_2D, noiseTex)
      gl.uniform1i(u(paperProg, 'u_noiseTexture'), 1)
      gl.uniform1f(u(paperProg, 'u_imageAspectRatio'), canvas.width / canvas.height)
      gl.uniform4f(u(paperProg, 'u_colorBack'), ...rgba('#ffffff'))
      gl.uniform4f(u(paperProg, 'u_colorC'), ...rgba('#7a7a75'))
      gl.uniform4f(u(paperProg, 'u_colorM'), ...rgba('#7a7a75'))
      gl.uniform4f(u(paperProg, 'u_colorY'), ...rgba('#7a7a75'))
      gl.uniform4f(u(paperProg, 'u_colorK'), ...rgba('#231f20'))
      gl.uniform1f(u(paperProg, 'u_size'), print.size)
      gl.uniform1f(u(paperProg, 'u_minDot'), 0)
      gl.uniform1f(u(paperProg, 'u_contrast'), print.contrast)
      gl.uniform1f(u(paperProg, 'u_gridNoise'), print.gridNoise)
      gl.uniform1f(u(paperProg, 'u_softness'), print.softness)
      gl.uniform1f(u(paperProg, 'u_type'), print.type) // 0 dots, 1 ink, 2 sharp
      gl.uniform1f(u(paperProg, 'u_grainSize'), 0)
      gl.uniform1f(u(paperProg, 'u_grainMixer'), 0)
      gl.uniform1f(u(paperProg, 'u_grainOverlay'), print.grainOverlay)
      // Glauber's original HalftoneCMYK plate settings
      gl.uniform1f(u(paperProg, 'u_floodC'), 0)
      gl.uniform1f(u(paperProg, 'u_floodM'), 0)
      gl.uniform1f(u(paperProg, 'u_floodY'), 0)
      gl.uniform1f(u(paperProg, 'u_floodK'), print.floodK)
      gl.uniform1f(u(paperProg, 'u_gainC'), -0.17)
      gl.uniform1f(u(paperProg, 'u_gainM'), -0.45)
      gl.uniform1f(u(paperProg, 'u_gainY'), -0.45)
      gl.uniform1f(u(paperProg, 'u_gainK'), 0)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    }
    renderRef.current(0) // first frame before the ticker starts

    // No explicit context teardown: the canvas element itself is dropped on
    // page unmount, and killing the context here breaks HMR remounts (React
    // refresh reuses the element, and a lost context stays lost).
    return () => {
      window.removeEventListener('resize', resize)
      renderRef.current = () => {}
    }
  }, [])

  useTicker((time) => renderRef.current(time))

  return <canvas ref={canvasRef} className="home__scene" aria-hidden="true" />
}

const VERT = `#version 300 es
in vec2 a_position;
out vec2 v_uv;
out vec2 v_imageUV;
void main() {
  v_uv = a_position * 0.5 + 0.5;
  v_imageUV = v_uv;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`

/* Pass 1: the raymarched cube ring. Lit color out, no post-processing. */
const SCENE_FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform vec2 u_resolution;
uniform float u_time;
uniform vec3 u_ring;  /* ring radius, cube half-size, cube count */
uniform vec2 u_cam;   /* camera height, pull-back from ring center */
uniform float u_band;  /* vertical band position on screen (uv units, + = up) */
uniform float u_focus; /* center focus: fade cubes toward the side edges, 0..1 */
uniform float u_clear; /* text knockout strength, 0..1 */
out vec4 fragColor;

float hash(float n) {
  return fract(sin(n * 127.1) * 43758.5453);
}

mat2 rot(float a) {
  float c = cos(a), s = sin(a);
  return mat2(c, -s, s, c);
}

float sdBox(vec3 p, vec3 b) {
  vec3 q = abs(p) - b;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}

/* One cube of the ring, in sector-local space. */
float cube(vec3 p, float sector) {
  sector = mod(sector, floor(u_ring.z + 0.5)); /* wrap so the atan seam agrees */
  p.x -= u_ring.x;                       /* out to the ring radius */
  float tumble = u_time * 0.4 + sector * 2.4 + hash(sector) * 6.28;
  p.xy = rot(tumble) * p.xy;             /* each cube rotates infinitely */
  p.yz = rot(tumble * 0.7) * p.yz;
  float s = u_ring.y * (0.8 + 0.4 * hash(sector + 13.0));
  return sdBox(p, vec3(s));
}

/* Circular array via polar repetition; neighbors checked so near cubes
   never get clipped at sector borders. */
float map(vec3 p) {
  float cnt = floor(u_ring.z + 0.5); /* fractional counts would break the seam */
  float step = 6.28318 / cnt;
  float a = atan(p.z, p.x) + u_time * 0.06; /* the whole ring drifts */
  float sector = floor(a / step + 0.5);
  float d = 1e5;
  for (int i = -2; i <= 2; i++) {
    float s = sector + float(i);
    float sa = s * step - u_time * 0.06;
    vec3 q = vec3(cos(sa) * p.x + sin(sa) * p.z, p.y, -sin(sa) * p.x + cos(sa) * p.z);
    d = min(d, cube(q, s));
  }
  return d;
}

vec3 normalAt(vec3 p) {
  vec2 e = vec2(0.002, 0.0);
  return normalize(vec3(
    map(p + e.xyy) - map(p - e.xyy),
    map(p + e.yxy) - map(p - e.yxy),
    map(p + e.yyx) - map(p - e.yyx)
  ));
}

float softShadow(vec3 ro, vec3 rd) {
  float res = 1.0, t = 0.08;
  for (int i = 0; i < 24; i++) {
    float h = map(ro + rd * t);
    res = min(res, 9.0 * h / t);
    t += clamp(h, 0.03, 0.4);
    if (res < 0.01 || t > 8.0) break;
  }
  return clamp(res, 0.0, 1.0);
}

float ambientOcclusion(vec3 p, vec3 n) {
  float occ = 0.0, w = 1.0;
  for (int i = 1; i <= 4; i++) {
    float h = 0.05 * float(i);
    occ += w * (h - map(p + n * h));
    w *= 0.6;
  }
  return clamp(1.0 - 2.2 * occ, 0.0, 1.0);
}

void main() {
  vec2 px = v_uv * u_resolution;
  vec2 uv = (px - 0.5 * u_resolution) / u_resolution.y;

  /* Straight front view: camera level with the ring plane (no tilt),
     pulled back outside the ring — the near arc prints big and dark, the
     back half dissolves to white (only half the array reads). u_band is a
     lens shift placing the band vertically without perspective distortion. */
  vec3 ro = vec3(0.0, u_cam.x, u_cam.y);
  vec3 rd = normalize(vec3(uv.x, uv.y - u_band, -1.5));

  float t = 0.0;
  float hit = -1.0;
  for (int i = 0; i < 80; i++) {
    vec3 p = ro + rd * t;
    float d = map(p);
    if (d < 0.001 * t) { hit = t; break; }
    t += d * 0.9;
    if (t > 14.0) break;
  }

  vec3 col = vec3(1.0);

  if (hit > 0.0) {
    vec3 p = ro + rd * hit;
    vec3 n = normalAt(p);
    vec3 l = normalize(vec3(0.45, 0.85, 0.3));

    float diffuse = max(dot(n, l), 0.0);
    float shadow = softShadow(p + n * 0.02, l);
    float occ = ambientOcclusion(p, n);
    float lum = clamp(0.3 + 0.7 * diffuse * shadow, 0.0, 1.0) * occ;

    /* Warm-dark shadows so the C/M/Y plates separate (pure gray would
       print K only). */
    vec3 shaded = mix(vec3(0.17, 0.13, 0.10), vec3(1.0), lum);

    /* Closer to the camera = more present; farther dissolves to white. */
    float depth = smoothstep(u_cam.y - u_ring.x * 1.05, u_cam.y + u_ring.x * 1.1, hit);
    col = mix(shaded, vec3(1.0), depth * 0.8);

    /* Center focus, by RING ANGLE: a cube is strongest while it faces the
       camera (projecting mid-viewport) and dissolves as it travels toward
       the sides — coherent with the drift, immune to window shape. */
    float ang = abs(atan(p.x, p.z));
    float side = smoothstep(0.5, 1.45, ang);
    col = mix(col, vec3(1.0), side * u_focus);
  }

  /* Print knockout: fade the scene to paper over the text column. */
  vec2 k = (px - vec2(0.5, 0.78) * u_resolution) / u_resolution.y;
  float protect = smoothstep(0.23, 0.55, length(k * vec2(0.85, 1.3)));
  col = mix(vec3(1.0), col, mix(1.0, protect, u_clear));

  fragColor = vec4(col, 1.0);
}`

/* Pass 2: Paper Shaders HalftoneCmyk, verbatim.
   (c) Paper Design — github.com/paper-design/shaders — Apache-2.0 */
const PAPER_FRAG = `#version 300 es
precision mediump float;

uniform sampler2D u_image;
uniform float u_imageAspectRatio;

uniform vec4 u_colorBack;
uniform vec4 u_colorC;
uniform vec4 u_colorM;
uniform vec4 u_colorY;
uniform vec4 u_colorK;
uniform float u_size;
uniform float u_minDot;
uniform float u_contrast;
uniform float u_grainSize;
uniform float u_grainMixer;
uniform float u_grainOverlay;
uniform float u_gridNoise;
uniform float u_softness;
uniform float u_floodC;
uniform float u_floodM;
uniform float u_floodY;
uniform float u_floodK;
uniform float u_gainC;
uniform float u_gainM;
uniform float u_gainY;
uniform float u_gainK;
uniform float u_type;
uniform sampler2D u_noiseTexture;

in vec2 v_imageUV;
out vec4 fragColor;

const float shiftC = -.5;
const float shiftM = -.25;
const float shiftY = .2;
const float shiftK = 0.;

// Precomputed sin/cos for rotation angles (15\xB0, 75\xB0, 0\xB0, 45\xB0)
const float cosC = 0.9659258;  const float sinC = 0.2588190;   // 15\xB0
const float cosM = 0.2588190;  const float sinM = 0.9659258;   // 75\xB0
const float cosY = 1.0;        const float sinY = 0.0;         // 0\xB0
const float cosK = 0.7071068;  const float sinK = 0.7071068;   // 45\xB0

#define TWO_PI 6.28318530718
#define PI 3.14159265358979323846

vec2 randomRG(vec2 p) {
  vec2 uv = floor(p) / 100. + .5;
  return texture(u_noiseTexture, fract(uv)).rg;
}
vec3 hash23(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.3183099, 0.3678794, 0.3141592)) + 0.1;
  p3 += dot(p3, p3.yzx + 19.19);
  return fract(vec3(p3.x * p3.y, p3.y * p3.z, p3.z * p3.x));
}

float sst(float edge0, float edge1, float x) {
  return smoothstep(edge0, edge1, x);
}

vec3 valueNoise3(vec2 st) {
  vec2 i = floor(st);
  vec2 f = fract(st);
  vec3 a = hash23(i);
  vec3 b = hash23(i + vec2(1.0, 0.0));
  vec3 c = hash23(i + vec2(0.0, 1.0));
  vec3 d = hash23(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  vec3 x1 = mix(a, b, u.x);
  vec3 x2 = mix(c, d, u.x);
  return mix(x1, x2, u.y);
}

float getUvFrame(vec2 uv, vec2 pad) {
  float left   = smoothstep(-pad.x, 0., uv.x);
  float right  = smoothstep(1. + pad.x, 1., uv.x);
  float bottom = smoothstep(-pad.y, 0., uv.y);
  float top    = smoothstep(1. + pad.y, 1., uv.y);

  return left * right * bottom * top;
}

vec4 RGBAtoCMYK(vec4 rgba) {
  float k = 1. - max(max(rgba.r, rgba.g), rgba.b);
  float denom = 1. - k;
  vec3 cmy = vec3(0.);
  if (denom > 1e-5) {
    cmy = (1. - rgba.rgb - vec3(k)) / denom;
  }
  return vec4(cmy, k) * rgba.a;
}

vec3 applyContrast(vec3 rgb) {
  return clamp((rgb - 0.5) * u_contrast + 0.5, 0.0, 1.0);
}

// Single-component CMYK extractors with contrast built-in, alpha-aware
float getCyan(vec4 rgba) {
  vec3 c = clamp((rgba.rgb - 0.5) * u_contrast + 0.5, 0.0, 1.0);
  float maxRGB = max(max(c.r, c.g), c.b);
  return (maxRGB > 1e-5 ? (maxRGB - c.r) / maxRGB : 0.) * rgba.a;
}
float getMagenta(vec4 rgba) {
  vec3 c = clamp((rgba.rgb - 0.5) * u_contrast + 0.5, 0.0, 1.0);
  float maxRGB = max(max(c.r, c.g), c.b);
  return (maxRGB > 1e-5 ? (maxRGB - c.g) / maxRGB : 0.) * rgba.a;
}
float getYellow(vec4 rgba) {
  vec3 c = clamp((rgba.rgb - 0.5) * u_contrast + 0.5, 0.0, 1.0);
  float maxRGB = max(max(c.r, c.g), c.b);
  return (maxRGB > 1e-5 ? (maxRGB - c.b) / maxRGB : 0.) * rgba.a;
}
float getBlack(vec4 rgba) {
  vec3 c = clamp((rgba.rgb - 0.5) * u_contrast + 0.5, 0.0, 1.0);
  return (1. - max(max(c.r, c.g), c.b)) * rgba.a;
}

vec2 cellCenterPos(vec2 uv, vec2 cellOffset, float channelIdx) {
  vec2 cellCenter = floor(uv) + .5 + cellOffset;
  return cellCenter + (randomRG(cellCenter + channelIdx * 50.) - .5) * u_gridNoise;
}

vec2 gridToImageUV(vec2 cellCenter, float cosA, float sinA, float shift, vec2 pad) {
  vec2 uvGrid = mat2(cosA, -sinA, sinA, cosA) * (cellCenter - shift);
  return uvGrid * pad + 0.5;
}

void colorMask(vec2 pos, vec2 cellCenter, float rad, float transparency, float grain, float channelAddon, float channelgain, float generalComp, bool isJoined, inout float outMask) {
  float dist = length(pos - cellCenter);

  float radius = rad;
  radius *= (1. + generalComp);
  radius += (.15 + channelgain * radius);
  radius = max(0., radius);
  radius = mix(0., radius, transparency);
  radius += channelAddon;
  radius *= (1. - grain);

  float mask = 1. - sst(0., radius, dist);
  if (isJoined) {
    // ink or sharp (joined)
    mask = pow(mask, 1.2);
  } else {
    // dots (separate)
    mask = sst(.5 - .5 * u_softness, .51 + .49 * u_softness, mask);
  }

  mask *= mix(1., mix(.5, 1., 1.5 * radius), u_softness);
  outMask += mask;
}

vec3 applyInk(vec3 paper, vec3 inkColor, float cov) {
  vec3 inkEffect = mix(vec3(1.0), inkColor, clamp(cov, 0.0, 1.0));
  return paper * inkEffect;
}

void main() {
  vec2 uv = v_imageUV;

  float cellsPerSide = mix(400.0, 7.0, pow(u_size, 0.7));
  float cellSizeY = 1.0 / cellsPerSide;
  vec2 pad = cellSizeY * vec2(1.0 / u_imageAspectRatio, 1.0);
  vec2 uvGrid = (uv - .5) / pad;
  float insideImageBox = getUvFrame(uv, pad);

  float generalComp = .1 * u_softness + .1 * u_gridNoise + .1 * (1. - step(0.5, u_type)) * (1.5 - u_softness);

  vec2 uvC = mat2(cosC, sinC, -sinC, cosC) * uvGrid + shiftC;
  vec2 uvM = mat2(cosM, sinM, -sinM, cosM) * uvGrid + shiftM;
  vec2 uvY = mat2(cosY, sinY, -sinY, cosY) * uvGrid + shiftY;
  vec2 uvK = mat2(cosK, sinK, -sinK, cosK) * uvGrid + shiftK;

  vec2 grainSize = mix(2000., 200., u_grainSize) * vec2(1., 1. / u_imageAspectRatio);
  vec2 grainUV = (v_imageUV - .5) * grainSize + .5;
  vec3 noiseValues = valueNoise3(grainUV);
  float grain = sst(.55, 1., noiseValues.r);
  grain *= u_grainMixer;

  vec4 outMask = vec4(0.);
  bool isJoined = u_type > 0.5;

  if (u_type < 1.5) {
    // dots or ink: per-cell color sampling
    for (int dy = -1; dy <= 1; dy++) {
      for (int dx = -1; dx <= 1; dx++) {
        vec2 cellOffset = vec2(float(dx), float(dy));

        vec2 cellCenterC = cellCenterPos(uvC, cellOffset, 0.);
        vec4 texC = texture(u_image, gridToImageUV(cellCenterC, cosC, sinC, shiftC, pad));
        colorMask(uvC, cellCenterC, getCyan(texC), insideImageBox * texC.a, grain, u_floodC, u_gainC, generalComp, isJoined, outMask[0]);

        vec2 cellCenterM = cellCenterPos(uvM, cellOffset, 1.);
        vec4 texM = texture(u_image, gridToImageUV(cellCenterM, cosM, sinM, shiftM, pad));
        colorMask(uvM, cellCenterM, getMagenta(texM), insideImageBox * texM.a, grain, u_floodM, u_gainM, generalComp, isJoined, outMask[1]);

        vec2 cellCenterY = cellCenterPos(uvY, cellOffset, 2.);
        vec4 texY = texture(u_image, gridToImageUV(cellCenterY, cosY, sinY, shiftY, pad));
        colorMask(uvY, cellCenterY, getYellow(texY), insideImageBox * texY.a, grain, u_floodY, u_gainY, generalComp, isJoined, outMask[2]);

        vec2 cellCenterK = cellCenterPos(uvK, cellOffset, 3.);
        vec4 texK = texture(u_image, gridToImageUV(cellCenterK, cosK, sinK, shiftK, pad));
        colorMask(uvK, cellCenterK, getBlack(texK), insideImageBox * texK.a, grain, u_floodK, u_gainK, generalComp, isJoined, outMask[3]);
      }
    }
  } else {
    // sharp: direct px color sampling
    vec4 tex = texture(u_image, uv);
    tex.rgb = applyContrast(tex.rgb);
    insideImageBox *= tex.a;
    vec4 cmykOriginal = RGBAtoCMYK(tex);
    for (int dy = -1; dy <= 1; dy++) {
      for (int dx = -1; dx <= 1; dx++) {
        vec2 cellOffset = vec2(float(dx), float(dy));

        colorMask(uvC, cellCenterPos(uvC, cellOffset, 0.), cmykOriginal.x, insideImageBox, grain, u_floodC, u_gainC, generalComp, isJoined, outMask[0]);
        colorMask(uvM, cellCenterPos(uvM, cellOffset, 1.), cmykOriginal.y, insideImageBox, grain, u_floodM, u_gainM, generalComp, isJoined, outMask[1]);
        colorMask(uvY, cellCenterPos(uvY, cellOffset, 2.), cmykOriginal.z, insideImageBox, grain, u_floodY, u_gainY, generalComp, isJoined, outMask[2]);
        colorMask(uvK, cellCenterPos(uvK, cellOffset, 3.), cmykOriginal.w, insideImageBox, grain, u_floodK, u_gainK, generalComp, isJoined, outMask[3]);
      }
    }
  }

  float shape;

  float C = outMask[0];
  float M = outMask[1];
  float Y = outMask[2];
  float K = outMask[3];

  if (isJoined) {
    // ink or sharp: apply threshold for joined dots
    float th = .5;
    float sLeft = th * u_softness;
    float sRight = (1. - th) * u_softness + .01;
    C = smoothstep(th - sLeft - fwidth(C), th + sRight, C);
    M = smoothstep(th - sLeft - fwidth(M), th + sRight, M);
    Y = smoothstep(th - sLeft - fwidth(Y), th + sRight, Y);
    K = smoothstep(th - sLeft - fwidth(K), th + sRight, K);
  }

  C *= u_colorC.a;
  M *= u_colorM.a;
  Y *= u_colorY.a;
  K *= u_colorK.a;

  vec3 ink = vec3(1.);
  ink = applyInk(ink, u_colorK.rgb, K);
  ink = applyInk(ink, u_colorC.rgb, C);
  ink = applyInk(ink, u_colorM.rgb, M);
  ink = applyInk(ink, u_colorY.rgb, Y);

  shape = clamp(max(max(C, M), max(Y, K)), 0., 1.);

  vec3 color = u_colorBack.rgb * u_colorBack.a;

  float opacity = u_colorBack.a;
  color = mix(color, ink, shape);
  opacity += shape;
  opacity = clamp(opacity, 0., 1.);

  float grainOverlay = mix(noiseValues.g, noiseValues.b, .5);
  grainOverlay = pow(grainOverlay, 1.3);

  float grainOverlayV = grainOverlay * 2. - 1.;
  vec3 grainOverlayColor = vec3(step(0., grainOverlayV));
  float grainOverlayStrength = u_grainOverlay * abs(grainOverlayV);
  grainOverlayStrength = pow(grainOverlayStrength, .8);
  color = mix(color, grainOverlayColor, .5 * grainOverlayStrength);

  opacity += .5 * grainOverlayStrength;
  opacity = clamp(opacity, 0., 1.);

  fragColor = vec4(color, opacity);
}`

function buildProgram(
  gl: WebGL2RenderingContext,
  vertSrc: string,
  fragSrc: string,
): WebGLProgram | null {
  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type)
    if (!shader) return null
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('[scene]', gl.getShaderInfoLog(shader))
      return null
    }
    return shader
  }
  const vert = compile(gl.VERTEX_SHADER, vertSrc)
  const frag = compile(gl.FRAGMENT_SHADER, fragSrc)
  if (!vert || !frag) return null
  const program = gl.createProgram()
  if (!program) return null
  gl.attachShader(program, vert)
  gl.attachShader(program, frag)
  gl.linkProgram(program)
  return program
}
