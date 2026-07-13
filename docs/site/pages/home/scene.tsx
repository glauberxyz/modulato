import { useEffect, useRef } from 'react'
import { resolveTokens, useTicker } from 'modulato'
import tokens from './motion'

/**
 * Full-viewport background: a circular array of 3D cubes, each rotating
 * infinitely, raymarched with a directional light, soft shadows and ambient
 * occlusion. Depth fades to the white page — cubes near the camera print
 * dark, far ones dissolve — and the shading is screened through a halftone
 * dot pattern (the site's print identity). The text column sits inside the
 * ring. Runs on the framework ticker; `scene` tokens are tweakable live.
 */
export function Scene() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const renderRef = useRef<(timeMs: number) => void>(() => {})

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const gl = canvas.getContext('webgl', { antialias: false, alpha: false })
    if (!gl) return

    const program = buildProgram(gl)
    if (!program) return
    gl.useProgram(program)

    // Fullscreen triangle
    const buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const position = gl.getAttribLocation(program, 'a_position')
    gl.enableVertexAttribArray(position)
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)

    const uResolution = gl.getUniformLocation(program, 'u_resolution')
    const uTime = gl.getUniformLocation(program, 'u_time')
    const uDot = gl.getUniformLocation(program, 'u_dot')
    const uRing = gl.getUniformLocation(program, 'u_ring') // radius, cube size, count
    const uCam = gl.getUniformLocation(program, 'u_cam') // height, distance
    const uClear = gl.getUniformLocation(program, 'u_clear')

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const resize = () => {
      canvas.width = Math.round(canvas.clientWidth * dpr)
      canvas.height = Math.round(canvas.clientHeight * dpr)
      gl.viewport(0, 0, canvas.width, canvas.height)
    }
    resize()
    window.addEventListener('resize', resize)

    renderRef.current = (timeMs) => {
      const { speed, dot, radius, size, count, camHeight, camDist, clear } = resolveTokens(tokens).scene
      gl.uniform2f(uResolution, canvas.width, canvas.height)
      gl.uniform1f(uTime, (timeMs / 1000) * speed)
      gl.uniform1f(uDot, dot * dpr)
      gl.uniform3f(uRing, radius, size, count)
      gl.uniform2f(uCam, camHeight, camDist)
      gl.uniform1f(uClear, clear)
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

const VERT = `
attribute vec2 a_position;
varying vec2 v_uv;
void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`

const FRAG = `
precision highp float;
varying vec2 v_uv;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_dot;  /* halftone screen cell, in device px */
uniform vec3 u_ring;  /* ring radius, cube half-size, cube count */
uniform vec2 u_cam;   /* camera height, camera distance */
uniform float u_clear; /* text knockout strength, 0..1 */

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
  sector = mod(sector, u_ring.z);        /* wrap so the atan seam agrees */
  p.x -= u_ring.x;                       /* out to the ring radius */
  float tumble = u_time * 0.4 + sector * 2.4 + hash(sector) * 6.28;
  p.xy = rot(tumble) * p.xy;             /* each cube rotates infinitely */
  p.yz = rot(tumble * 0.7) * p.yz;
  float s = u_ring.y * (0.8 + 0.4 * hash(sector + 13.0));
  return sdBox(p, vec3(s));
}

/* Circular array via polar repetition; check the neighbor sectors too so
   large cubes never get clipped at sector borders. */
float map(vec3 p) {
  float step = 6.28318 / u_ring.z;
  float a = atan(p.z, p.x) + u_time * 0.06; /* the whole ring drifts */
  float r = length(p.xz);
  float sector = floor(a / step + 0.5);
  float d = 1e5;
  for (int i = -2; i <= 2; i++) {
    float s = sector + float(i);
    float sa = s * step - u_time * 0.06;
    /* rotate p around Y by sa: sector-local space with the cube on +x */
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

/* Round-dot halftone: ink amount -> dot coverage on a 45deg screen. */
float halftone(vec2 px, float ink) {
  vec2 q = rot(0.7854) * px / u_dot;
  vec2 f = fract(q) - 0.5;
  float r = sqrt(clamp(ink, 0.0, 1.0)) * 0.7;
  return smoothstep(r, r - 0.2, length(f));
}

void main() {
  vec2 px = v_uv * u_resolution;
  vec2 uv = (px - 0.5 * u_resolution) / u_resolution.y;

  /* Camera above the ring plane, looking at its center — the ring reads as
     an ellipse around the page column; bottom cubes are near, top far. */
  vec3 ro = vec3(0.0, u_cam.x, u_cam.y);
  vec3 target = vec3(0.0, 0.0, 0.0);
  vec3 fwd = normalize(target - ro);
  vec3 right = normalize(cross(fwd, vec3(0.0, 1.0, 0.0)));
  vec3 up = cross(right, fwd);
  vec3 rd = normalize(fwd * 1.5 + right * uv.x + up * uv.y);

  float t = 0.0;
  float hit = -1.0;
  for (int i = 0; i < 80; i++) {
    vec3 p = ro + rd * t;
    float d = map(p);
    if (d < 0.001 * t) { hit = t; break; }
    t += d * 0.9;
    if (t > 14.0) break;
  }

  vec3 white = vec3(1.0);
  float ink = 0.0;

  if (hit > 0.0) {
    vec3 p = ro + rd * hit;
    vec3 n = normalAt(p);
    vec3 l = normalize(vec3(0.45, 0.85, 0.3));

    float diffuse = max(dot(n, l), 0.0);
    float shadow = softShadow(p + n * 0.02, l);
    float occ = ambientOcclusion(p, n);
    float lum = clamp(0.32 + 0.68 * diffuse * shadow, 0.0, 1.0) * occ;

    /* Closer to the camera = darker print; farther dissolves to white. */
    float depth = smoothstep(u_cam.y - u_ring.x - 1.2, u_cam.y + u_ring.x + 1.6, hit);
    float presence = 1.0 - depth;
    ink = (1.0 - lum) * mix(0.25, 1.0, presence) + 0.06 * presence;
  }

  /* Print knockout: lift ink over the text column (bottom center). */
  vec2 k = (px - vec2(0.5, 0.78) * u_resolution) / u_resolution.y;
  float protect = smoothstep(0.23, 0.55, length(k * vec2(0.85, 1.3)));
  ink *= mix(1.0, protect, u_clear);

  float dots = halftone(px, ink);
  vec3 inkColor = vec3(0.137, 0.122, 0.125); /* #231f20 */
  vec3 col = mix(white, inkColor, dots * 0.92);

  /* Print grain. */
  float grain = fract(sin(dot(px, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
  col += grain * 0.03;

  gl_FragColor = vec4(col, 1.0);
}`

function buildProgram(gl: WebGLRenderingContext): WebGLProgram | null {
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
  const vert = compile(gl.VERTEX_SHADER, VERT)
  const frag = compile(gl.FRAGMENT_SHADER, FRAG)
  if (!vert || !frag) return null
  const program = gl.createProgram()
  if (!program) return null
  gl.attachShader(program, vert)
  gl.attachShader(program, frag)
  gl.linkProgram(program)
  return program
}
