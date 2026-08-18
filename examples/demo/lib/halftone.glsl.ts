/**
 * The shaders behind this site.
 *
 * HALFTONE_FRAG is Paper Design's HalftoneCmyk fragment shader
 * (github.com/paper-design/shaders, Apache-2.0, (c) Paper Design). Their
 * separation, their masks, their ink model; the additions below are ours and
 * every one is marked MODIFIED at the line it touches.
 *
 *   u_angles                  their four screen angles were compile-time
 *                             constants (const float cosC = 0.9659258 …) and
 *                             chapter III has to turn them, so they became a
 *                             uniform in degrees with sin/cos per frame
 *   u_window                  neighbor search radius, so chapter IV can break
 *                             the 3x3 loop and show what happens
 *   u_plates                  per-plate mute
 *   u_noBlack                 separate with no black plate at all — not the
 *                             same as muting K, since the normal separation
 *                             divides each color by max(r,g,b) precisely
 *                             BECAUSE black carries the common part
 *   u_warm / u_cool           split-tone before separating, so a monochrome
 *                             source has something for the color screens
 *   u_cover / u_sourceAspect  fill the frame and crop rather than stretch
 *
 * Everything else is theirs, unedited.
 *
 * SCENE_FRAG raymarches the ring of cuboids that the halftone screens on the
 * index and in the darkroom: SDF box, one directional light, soft shadows,
 * ambient occlusion. Standard technique, per iquilezles.org.
 */

export const VERT = `#version 300 es
in vec2 a_position;
out vec2 v_uv;
void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`

export const SCENE_FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform vec2 u_resolution;
uniform float u_time;
uniform vec3 u_ring;   /* radius, pillar half-height, pillar count */
uniform vec2 u_cam;    /* camera height, pull-back */
uniform float u_band;  /* vertical lens shift */
uniform float u_cap;   /* highlight cap — a fully lit face prints white */
out vec4 fragColor;

float sdBox(vec3 p, vec3 b) {
  vec3 q = abs(p) - b;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}

float map(vec3 p) {
  float cnt = floor(u_ring.z + 0.5);
  float w = 0.28 * u_ring.x * 3.14159 / cnt;
  /* Bounding tube: a cheap lower bound so rays far from the ring leap. */
  float lb = max(abs(length(p.xz) - u_ring.x) - w * 1.5, abs(p.y) - u_ring.y);
  if (lb > 0.3) return lb;
  float step = 6.28318 / cnt;
  float d = 1e5;
  for (float i = 0.0; i < 48.0; i++) {
    if (i >= cnt) break;
    float sa = i * step - u_time * 0.06;
    vec3 q = vec3(cos(sa) * p.x + sin(sa) * p.z, p.y, -sin(sa) * p.x + cos(sa) * p.z);
    q.x -= u_ring.x;
    d = min(d, sdBox(q, vec3(w, u_ring.y, w)));
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
  vec3 ro = vec3(0.0, u_cam.x, u_cam.y);
  vec3 rd = normalize(vec3(uv.x, uv.y - u_band, -1.5));

  float t = 0.0, hit = -1.0;
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
    vec3 l = normalize(vec3(-0.75, 0.45, 0.35));
    float lum = min(clamp(0.34 + 0.66 * max(dot(n, l), 0.0) * softShadow(p + n * 0.02, l), 0.0, 1.0)
                    * ambientOcclusion(p, n), u_cap);
    /* Warm the shadows so C/M/Y have something to carry — a neutral scene
       would separate onto the K plate alone. Chapter III explains why. */
    col = mix(vec3(0.17, 0.13, 0.10), vec3(1.0), lum);
  }
  fragColor = vec4(col, 1.0);
}`

export const HALFTONE_FRAG = `#version 300 es
precision mediump float;

uniform sampler2D u_image;
uniform float u_imageAspectRatio;
uniform vec4 u_colorBack;
uniform vec4 u_colorC;
uniform vec4 u_colorM;
uniform vec4 u_colorY;
uniform vec4 u_colorK;
uniform float u_size;
uniform float u_contrast;
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
uniform vec4 u_angles;   /* MODIFIED: C, M, Y, K screen angles in degrees */
uniform float u_window;  /* MODIFIED: neighbor radius — 0 = 1x1, 1 = 3x3, 2 = 5x5 */
uniform vec4 u_plates;   /* MODIFIED: per-plate on/off for the separation diagram */
/* MODIFIED: 1 = separate with NO black plate, the naive three-ink way.
   Not the same as muting K with u_plates: the normal separation is gray
   component removal, where each color plate is divided by max(r,g,b) —
   precisely BECAUSE black is carrying the common part. Take K away and
   leave the division in and you get a washed-out picture, not the muddy
   one printers actually got. Each ink has to carry its whole channel. */
uniform float u_noBlack;
/* MODIFIED: rgb = the color shadows are pulled toward, a = how far. */
uniform vec4 u_warm;
/* MODIFIED: the color highlights are pulled toward. */
uniform vec3 u_cool;
/* MODIFIED: 1 = fill the frame and crop, keeping the source's proportions.
   0 keeps the original behavior, which stretches the source over the frame
   whatever shape either of them is. */
uniform float u_cover;
/* MODIFIED: the source's OWN aspect, for that crop. Distinct from
   u_imageAspectRatio, which sets cell geometry and is the frame's aspect
   whenever covering — that is what keeps the dots round. */
uniform float u_sourceAspect;
uniform sampler2D u_noiseTexture;

in vec2 v_uv;
out vec4 fragColor;

const float shiftC = -.5;
const float shiftM = -.25;
const float shiftY = .2;
const float shiftK = 0.;

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
float sst(float edge0, float edge1, float x) { return smoothstep(edge0, edge1, x); }

vec3 valueNoise3(vec2 st) {
  vec2 i = floor(st), f = fract(st);
  vec3 a = hash23(i), b = hash23(i + vec2(1, 0)), c = hash23(i + vec2(0, 1)), d = hash23(i + vec2(1, 1));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float getUvFrame(vec2 uv, vec2 pad) {
  return smoothstep(-pad.x, 0., uv.x) * smoothstep(1. + pad.x, 1., uv.x)
       * smoothstep(-pad.y, 0., uv.y) * smoothstep(1. + pad.y, 1., uv.y);
}

/* MODIFIED: split-tone before separating — shadows toward u_warm.rgb,
   highlights toward u_cool, by u_warm.a. Default 0 = untouched.

   NOTE: no backticks anywhere below. This whole shader is a JS template
   literal, so one in a comment ends the string and the file stops being
   valid TypeScript several hundred lines later.

   This is not a look, it is what makes a monochrome source printable in
   color at all. The separation gives C = M = Y = (max − channel) / max,
   which is exactly zero when r = g = b — so a neutral photograph puts
   everything on the black plate and the other three screens have nothing to
   carry. Chapter III says exactly that in prose; a diagram about rotating
   four screens has to have four screens to rotate.

   TWO colors and not one, and the reason is the separation itself: whichever
   channel is largest gets a plate of zero, so a single tint kills the same
   plate at every pixel — warm everything and cyan is gone from the whole
   image. Warm shadows against cool highlights put the maximum in a different
   channel at each end of the range, so the dead plate moves: yellow drops out
   of the highlights, cyan out of the shadows, and all four screens have
   somewhere to print. Split toning is a darkroom technique, not a trick. */
vec3 applyContrast(vec3 rgb) {
  vec3 c = clamp((rgb - 0.5) * u_contrast + 0.5, 0.0, 1.0);
  float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
  return mix(c, mix(u_warm.rgb, u_cool, lum), u_warm.a);
}

float getCyan(vec4 c4) {
  vec3 c = applyContrast(c4.rgb); float m = max(max(c.r, c.g), c.b);
  return mix((m > 1e-5 ? (m - c.r) / m : 0.), 1. - c.r, u_noBlack) * c4.a;
}
float getMagenta(vec4 c4) {
  vec3 c = applyContrast(c4.rgb); float m = max(max(c.r, c.g), c.b);
  return mix((m > 1e-5 ? (m - c.g) / m : 0.), 1. - c.g, u_noBlack) * c4.a;
}
float getYellow(vec4 c4) {
  vec3 c = applyContrast(c4.rgb); float m = max(max(c.r, c.g), c.b);
  return mix((m > 1e-5 ? (m - c.b) / m : 0.), 1. - c.b, u_noBlack) * c4.a;
}
float getBlack(vec4 c4) {
  vec3 c = applyContrast(c4.rgb);
  return (1. - max(max(c.r, c.g), c.b)) * c4.a * (1. - u_noBlack);
}

vec2 cellCenterPos(vec2 uv, vec2 cellOffset, float channelIdx) {
  vec2 cellCenter = floor(uv) + .5 + cellOffset;
  return cellCenter + (randomRG(cellCenter + channelIdx * 50.) - .5) * u_gridNoise;
}
vec2 gridToImageUV(vec2 cellCenter, float cosA, float sinA, float shift, vec2 pad) {
  vec2 uv = (mat2(cosA, -sinA, sinA, cosA) * (cellCenter - shift)) * pad + 0.5;
  /* Cover: sample a centered window of the source whose shape matches the
     frame, so the source fills it and the overflow is cropped rather than
     squashed. Every plate goes through here, so one place does all four. */
  vec2 win = u_imageAspectRatio > u_sourceAspect
    ? vec2(1.0, u_sourceAspect / u_imageAspectRatio)
    : vec2(u_imageAspectRatio / u_sourceAspect, 1.0);
  return mix(uv, (uv - 0.5) * win + 0.5, u_cover);
}

void colorMask(vec2 pos, vec2 cellCenter, float rad, float transparency, float channelAddon,
               float channelgain, float generalComp, bool isJoined, inout float outMask) {
  float dist = length(pos - cellCenter);
  float radius = rad * (1. + generalComp);
  radius += (.15 + channelgain * radius);
  radius = max(0., radius);
  radius = mix(0., radius, transparency) + channelAddon;
  float mask = 1. - sst(0., radius, dist);
  if (isJoined) mask = pow(mask, 1.2);
  else mask = sst(.5 - .5 * u_softness, .51 + .49 * u_softness, mask);
  mask *= mix(1., mix(.5, 1., 1.5 * radius), u_softness);
  outMask += mask;
}

vec3 applyInk(vec3 paper, vec3 inkColor, float cov) {
  return paper * mix(vec3(1.0), inkColor, clamp(cov, 0.0, 1.0));
}

void main() {
  vec2 uv = v_uv;
  float cellsPerSide = mix(400.0, 7.0, pow(u_size, 0.7));
  vec2 pad = (1.0 / cellsPerSide) * vec2(1.0 / u_imageAspectRatio, 1.0);
  vec2 uvGrid = (uv - .5) / pad;
  float insideImageBox = getUvFrame(uv, pad);

  float generalComp = .1 * u_softness + .1 * u_gridNoise
                    + .1 * (1. - step(0.5, u_type)) * (1.5 - u_softness);

  /* MODIFIED: angles from the uniform rather than baked constants. */
  vec4 a = u_angles * PI / 180.0;
  float cosC = cos(a.x), sinC = sin(a.x);
  float cosM = cos(a.y), sinM = sin(a.y);
  float cosY = cos(a.z), sinY = sin(a.z);
  float cosK = cos(a.w), sinK = sin(a.w);

  vec2 uvC = mat2(cosC, sinC, -sinC, cosC) * uvGrid + shiftC;
  vec2 uvM = mat2(cosM, sinM, -sinM, cosM) * uvGrid + shiftM;
  vec2 uvY = mat2(cosY, sinY, -sinY, cosY) * uvGrid + shiftY;
  vec2 uvK = mat2(cosK, sinK, -sinK, cosK) * uvGrid + shiftK;

  vec2 grainUV = (v_uv - .5) * (2000. * vec2(1., 1. / u_imageAspectRatio)) + .5;
  vec3 noiseValues = valueNoise3(grainUV);

  vec4 outMask = vec4(0.);
  bool isJoined = u_type > 0.5;
  int w = int(u_window);

  for (int dy = -2; dy <= 2; dy++) {
    for (int dx = -2; dx <= 2; dx++) {
      if (abs(dx) > w || abs(dy) > w) continue;
      vec2 cellOffset = vec2(float(dx), float(dy));

      vec2 ccC = cellCenterPos(uvC, cellOffset, 0.);
      vec4 texC = texture(u_image, gridToImageUV(ccC, cosC, sinC, shiftC, pad));
      colorMask(uvC, ccC, getCyan(texC), insideImageBox * texC.a, u_floodC, u_gainC, generalComp, isJoined, outMask[0]);

      vec2 ccM = cellCenterPos(uvM, cellOffset, 1.);
      vec4 texM = texture(u_image, gridToImageUV(ccM, cosM, sinM, shiftM, pad));
      colorMask(uvM, ccM, getMagenta(texM), insideImageBox * texM.a, u_floodM, u_gainM, generalComp, isJoined, outMask[1]);

      vec2 ccY = cellCenterPos(uvY, cellOffset, 2.);
      vec4 texY = texture(u_image, gridToImageUV(ccY, cosY, sinY, shiftY, pad));
      colorMask(uvY, ccY, getYellow(texY), insideImageBox * texY.a, u_floodY, u_gainY, generalComp, isJoined, outMask[2]);

      vec2 ccK = cellCenterPos(uvK, cellOffset, 3.);
      vec4 texK = texture(u_image, gridToImageUV(ccK, cosK, sinK, shiftK, pad));
      colorMask(uvK, ccK, getBlack(texK), insideImageBox * texK.a, u_floodK, u_gainK, generalComp, isJoined, outMask[3]);
    }
  }

  float C = outMask[0], M = outMask[1], Y = outMask[2], K = outMask[3];

  if (isJoined) {
    float th = .5, sL = th * u_softness, sR = (1. - th) * u_softness + .01;
    C = smoothstep(th - sL - fwidth(C), th + sR, C);
    M = smoothstep(th - sL - fwidth(M), th + sR, M);
    Y = smoothstep(th - sL - fwidth(Y), th + sR, Y);
    K = smoothstep(th - sL - fwidth(K), th + sR, K);
  }

  /* MODIFIED: per-plate mute, for the separation diagram. */
  C *= u_colorC.a * u_plates.x;
  M *= u_colorM.a * u_plates.y;
  Y *= u_colorY.a * u_plates.z;
  K *= u_colorK.a * u_plates.w;

  vec3 ink = vec3(1.);
  ink = applyInk(ink, u_colorK.rgb, K);
  ink = applyInk(ink, u_colorC.rgb, C);
  ink = applyInk(ink, u_colorM.rgb, M);
  ink = applyInk(ink, u_colorY.rgb, Y);

  float shape = clamp(max(max(C, M), max(Y, K)), 0., 1.);
  vec3 color = u_colorBack.rgb * u_colorBack.a;
  float opacity = clamp(u_colorBack.a + shape, 0., 1.);
  color = mix(color, ink, shape);

  float go = pow(mix(noiseValues.g, noiseValues.b, .5), 1.3) * 2. - 1.;
  float gs = pow(u_grainOverlay * abs(go), .8);
  color = mix(color, vec3(step(0., go)), .5 * gs);

  fragColor = vec4(color, clamp(opacity + .5 * gs, 0., 1.));
}`
