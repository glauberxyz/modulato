// The halftone, in WGSL — the shader WebGPU runs. halftone.frag is the same
// press in GLSL, for browsers without WebGPU; the two are kept line for line
// alike so a change to one is easy to carry to the other.
//
// Paper Design's HalftoneCmyk (github.com/paper-design/shaders, Apache-2.0,
// (c) Paper Design), with this site's additions — angles, window, plates,
// noBlack, warm/cool, cover/sourceAspect. halftone.frag says what each one is
// for, at the line it touches.
//
// Translation notes, where WGSL and GLSL part ways:
//   * Uniforms are one struct; @modulato/gpu writes each field by name, so
//     `set('size')` reaches `u.size` here and `u_size` there.
//   * Every texture read is textureSampleLevel(…, 0). WGSL only allows the
//     implicit-LOD textureSample in uniform control flow, and these reads sit
//     in a loop; neither texture has mips, so level 0 is what GLSL sampled.
//   * `type` is a WGSL reserved word, so the field is `type_` — the trailing
//     underscore is one of the spellings `set('type')` looks for.
//   * smoothstep is spelled out as `sst`. Two of the edge pairs below run
//     high → low, which GLSL tolerates and WGSL leaves to the platform.

struct Uniforms {
  imageAspectRatio: f32,
  colorBack: vec4f,
  colorC: vec4f,
  colorM: vec4f,
  colorY: vec4f,
  colorK: vec4f,
  size: f32,
  contrast: f32,
  grainOverlay: f32,
  gridNoise: f32,
  softness: f32,
  floodC: f32,
  floodM: f32,
  floodY: f32,
  floodK: f32,
  gainC: f32,
  gainM: f32,
  gainY: f32,
  gainK: f32,
  type_: f32,
  angles: vec4f,
  window: f32,
  plates: vec4f,
  noBlack: f32,
  warm: vec4f,
  cool: vec3f,
  cover: f32,
  sourceAspect: f32,
}

@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var image: texture_2d<f32>;
@group(0) @binding(2) var imageSampler: sampler;
@group(0) @binding(3) var noiseTexture: texture_2d<f32>;
@group(0) @binding(4) var noiseTextureSampler: sampler;

const shiftC = -0.5;
const shiftM = -0.25;
const shiftY = 0.2;
const shiftK = 0.0;
const PI = 3.14159265358979323846;

fn sst(edge0: f32, edge1: f32, x: f32) -> f32 {
  let t = clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
  return t * t * (3.0 - 2.0 * t);
}

fn randomRG(p: vec2f) -> vec2f {
  let uv = floor(p) / 100.0 + 0.5;
  return textureSampleLevel(noiseTexture, noiseTextureSampler, fract(uv), 0.0).rg;
}

fn hash23(p: vec2f) -> vec3f {
  var p3 = fract(p.xyx * vec3f(0.3183099, 0.3678794, 0.3141592)) + 0.1;
  p3 += dot(p3, p3.yzx + 19.19);
  return fract(vec3f(p3.x * p3.y, p3.y * p3.z, p3.z * p3.x));
}

fn valueNoise3(st: vec2f) -> vec3f {
  let i = floor(st);
  let f = fract(st);
  let a = hash23(i);
  let b = hash23(i + vec2f(1.0, 0.0));
  let c = hash23(i + vec2f(0.0, 1.0));
  let d = hash23(i + vec2f(1.0, 1.0));
  let s = f * f * (3.0 - 2.0 * f);
  return mix(mix(a, b, s.x), mix(c, d, s.x), s.y);
}

fn getUvFrame(uv: vec2f, pad: vec2f) -> f32 {
  return sst(-pad.x, 0.0, uv.x) * sst(1.0 + pad.x, 1.0, uv.x)
       * sst(-pad.y, 0.0, uv.y) * sst(1.0 + pad.y, 1.0, uv.y);
}

fn applyContrast(rgb: vec3f) -> vec3f {
  let c = clamp((rgb - 0.5) * u.contrast + 0.5, vec3f(0.0), vec3f(1.0));
  let lum = dot(c, vec3f(0.2126, 0.7152, 0.0722));
  return mix(c, mix(u.warm.rgb, u.cool, lum), u.warm.a);
}

fn getCyan(c4: vec4f) -> f32 {
  let c = applyContrast(c4.rgb);
  let m = max(max(c.r, c.g), c.b);
  return mix(select(0.0, (m - c.r) / m, m > 1e-5), 1.0 - c.r, u.noBlack) * c4.a;
}
fn getMagenta(c4: vec4f) -> f32 {
  let c = applyContrast(c4.rgb);
  let m = max(max(c.r, c.g), c.b);
  return mix(select(0.0, (m - c.g) / m, m > 1e-5), 1.0 - c.g, u.noBlack) * c4.a;
}
fn getYellow(c4: vec4f) -> f32 {
  let c = applyContrast(c4.rgb);
  let m = max(max(c.r, c.g), c.b);
  return mix(select(0.0, (m - c.b) / m, m > 1e-5), 1.0 - c.b, u.noBlack) * c4.a;
}
fn getBlack(c4: vec4f) -> f32 {
  let c = applyContrast(c4.rgb);
  return (1.0 - max(max(c.r, c.g), c.b)) * c4.a * (1.0 - u.noBlack);
}

fn cellCenterPos(uv: vec2f, cellOffset: vec2f, channelIdx: f32) -> vec2f {
  let cellCenter = floor(uv) + 0.5 + cellOffset;
  return cellCenter + (randomRG(cellCenter + channelIdx * 50.0) - 0.5) * u.gridNoise;
}

fn gridToImageUV(cellCenter: vec2f, cosA: f32, sinA: f32, shift: f32, pad: vec2f) -> vec2f {
  let uv = (mat2x2f(cosA, -sinA, sinA, cosA) * (cellCenter - shift)) * pad + 0.5;
  let win = select(
    vec2f(u.imageAspectRatio / u.sourceAspect, 1.0),
    vec2f(1.0, u.sourceAspect / u.imageAspectRatio),
    u.imageAspectRatio > u.sourceAspect,
  );
  return mix(uv, (uv - 0.5) * win + 0.5, u.cover);
}

fn colorMask(pos: vec2f, cellCenter: vec2f, rad: f32, transparency: f32, channelAddon: f32,
             channelgain: f32, generalComp: f32, isJoined: bool) -> f32 {
  let dist = length(pos - cellCenter);
  var radius = rad * (1.0 + generalComp);
  radius += (0.15 + channelgain * radius);
  radius = max(0.0, radius);
  radius = mix(0.0, radius, transparency) + channelAddon;
  var mask = 1.0 - sst(0.0, radius, dist);
  if (isJoined) {
    mask = pow(mask, 1.2);
  } else {
    mask = sst(0.5 - 0.5 * u.softness, 0.51 + 0.49 * u.softness, mask);
  }
  mask *= mix(1.0, mix(0.5, 1.0, 1.5 * radius), u.softness);
  return mask;
}

fn applyInk(paper: vec3f, inkColor: vec3f, cov: f32) -> vec3f {
  return paper * mix(vec3f(1.0), inkColor, clamp(cov, 0.0, 1.0));
}

@fragment
fn main(@location(0) v_uv: vec2f) -> @location(0) vec4f {
  let uv = v_uv;
  let cellsPerSide = mix(400.0, 7.0, pow(u.size, 0.7));
  let pad = (1.0 / cellsPerSide) * vec2f(1.0 / u.imageAspectRatio, 1.0);
  let uvGrid = (uv - 0.5) / pad;
  let insideImageBox = getUvFrame(uv, pad);

  let generalComp = 0.1 * u.softness + 0.1 * u.gridNoise
                  + 0.1 * (1.0 - step(0.5, u.type_)) * (1.5 - u.softness);

  let a = u.angles * PI / 180.0;
  let cosC = cos(a.x); let sinC = sin(a.x);
  let cosM = cos(a.y); let sinM = sin(a.y);
  let cosY = cos(a.z); let sinY = sin(a.z);
  let cosK = cos(a.w); let sinK = sin(a.w);

  let uvC = mat2x2f(cosC, sinC, -sinC, cosC) * uvGrid + shiftC;
  let uvM = mat2x2f(cosM, sinM, -sinM, cosM) * uvGrid + shiftM;
  let uvY = mat2x2f(cosY, sinY, -sinY, cosY) * uvGrid + shiftY;
  let uvK = mat2x2f(cosK, sinK, -sinK, cosK) * uvGrid + shiftK;

  let grainUV = (v_uv - 0.5) * (2000.0 * vec2f(1.0, 1.0 / u.imageAspectRatio)) + 0.5;
  let noiseValues = valueNoise3(grainUV);

  var outMask = vec4f(0.0);
  let isJoined = u.type_ > 0.5;
  let w = i32(u.window);

  for (var dy: i32 = -2; dy <= 2; dy++) {
    for (var dx: i32 = -2; dx <= 2; dx++) {
      if (abs(dx) > w || abs(dy) > w) { continue; }
      let cellOffset = vec2f(f32(dx), f32(dy));

      let ccC = cellCenterPos(uvC, cellOffset, 0.0);
      let texC = textureSampleLevel(image, imageSampler, gridToImageUV(ccC, cosC, sinC, shiftC, pad), 0.0);
      outMask.x += colorMask(uvC, ccC, getCyan(texC), insideImageBox * texC.a, u.floodC, u.gainC, generalComp, isJoined);

      let ccM = cellCenterPos(uvM, cellOffset, 1.0);
      let texM = textureSampleLevel(image, imageSampler, gridToImageUV(ccM, cosM, sinM, shiftM, pad), 0.0);
      outMask.y += colorMask(uvM, ccM, getMagenta(texM), insideImageBox * texM.a, u.floodM, u.gainM, generalComp, isJoined);

      let ccY = cellCenterPos(uvY, cellOffset, 2.0);
      let texY = textureSampleLevel(image, imageSampler, gridToImageUV(ccY, cosY, sinY, shiftY, pad), 0.0);
      outMask.z += colorMask(uvY, ccY, getYellow(texY), insideImageBox * texY.a, u.floodY, u.gainY, generalComp, isJoined);

      let ccK = cellCenterPos(uvK, cellOffset, 3.0);
      let texK = textureSampleLevel(image, imageSampler, gridToImageUV(ccK, cosK, sinK, shiftK, pad), 0.0);
      outMask.w += colorMask(uvK, ccK, getBlack(texK), insideImageBox * texK.a, u.floodK, u.gainK, generalComp, isJoined);
    }
  }

  var C = outMask.x;
  var M = outMask.y;
  var Y = outMask.z;
  var K = outMask.w;

  // fwidth is a derivative, so it must run on every pixel of a quad — out
  // here, outside the branch, rather than inside it as GLSL lets you write.
  let fwC = fwidth(C);
  let fwM = fwidth(M);
  let fwY = fwidth(Y);
  let fwK = fwidth(K);
  if (isJoined) {
    let th = 0.5;
    let sL = th * u.softness;
    let sR = (1.0 - th) * u.softness + 0.01;
    C = sst(th - sL - fwC, th + sR, C);
    M = sst(th - sL - fwM, th + sR, M);
    Y = sst(th - sL - fwY, th + sR, Y);
    K = sst(th - sL - fwK, th + sR, K);
  }

  C *= u.colorC.a * u.plates.x;
  M *= u.colorM.a * u.plates.y;
  Y *= u.colorY.a * u.plates.z;
  K *= u.colorK.a * u.plates.w;

  var ink = vec3f(1.0);
  ink = applyInk(ink, u.colorK.rgb, K);
  ink = applyInk(ink, u.colorC.rgb, C);
  ink = applyInk(ink, u.colorM.rgb, M);
  ink = applyInk(ink, u.colorY.rgb, Y);

  let shape = clamp(max(max(C, M), max(Y, K)), 0.0, 1.0);
  var color = u.colorBack.rgb * u.colorBack.a;
  let opacity = clamp(u.colorBack.a + shape, 0.0, 1.0);
  color = mix(color, ink, shape);

  let go = pow(mix(noiseValues.g, noiseValues.b, 0.5), 1.3) * 2.0 - 1.0;
  let gs = pow(u.grainOverlay * abs(go), 0.8);
  color = mix(color, vec3f(step(0.0, go)), 0.5 * gs);

  return vec4f(color, clamp(opacity + 0.5 * gs, 0.0, 1.0));
}
