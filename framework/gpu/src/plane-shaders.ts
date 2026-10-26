/**
 * The shader a plane draws with when it names none: its element's image,
 * fitted the way the element's CSS fits it (`object-fit` fill, cover or
 * contain, centered), clipped to its `border-radius`, faded by its effective
 * opacity. A plane with no shader of its own should be indistinguishable
 * from the element it replaces.
 *
 * During a `<Shared>` flight it also crossfades from the source's image to
 * the destination's (`imageTo`, by `planeMorph`) — the same picture at two
 * resolutions, usually, so what it buys is the sharper one landing.
 *
 * It is also the template for writing one: every `plane*`, `imageSize`,
 * `imageToSize` uniform and the `image`/`imageTo` textures are filled by the
 * stage, per plane, per frame.
 */

export const PLANE_WGSL = /* wgsl */ `
struct Plane {
  planeSize: vec2f,
  imageSize: vec2f,
  imageToSize: vec2f,
  planeOpacity: f32,
  planeRadius: f32,
  planeFit: f32,
  planeMorph: f32,
}

@group(0) @binding(0) var<uniform> u: Plane;
@group(0) @binding(1) var image: texture_2d<f32>;
@group(0) @binding(2) var imageSampler: sampler;
@group(0) @binding(3) var imageTo: texture_2d<f32>;
@group(0) @binding(4) var imageToSampler: sampler;

// object-fit: 0 fill, 1 cover, 2 contain — always centered.
fn fitted(uv: vec2f, size: vec2f) -> vec2f {
  if (u.planeFit < 0.5) { return uv; }
  let ratio = u.planeSize / size;
  let scale = select(max(ratio.x, ratio.y), min(ratio.x, ratio.y), u.planeFit > 1.5);
  let span = size * scale / u.planeSize;
  return (uv - 0.5) / span + 0.5;
}

fn inside(st: vec2f) -> f32 {
  return step(0.0, st.x) * step(st.x, 1.0) * step(0.0, st.y) * step(st.y, 1.0);
}

// Coverage of a rounded rectangle, anti-aliased over one pixel.
fn rounded(uv: vec2f) -> f32 {
  let r = min(u.planeRadius, min(u.planeSize.x, u.planeSize.y) * 0.5);
  let p = abs((uv - 0.5) * u.planeSize) - (u.planeSize * 0.5 - r);
  let d = length(max(p, vec2f(0.0))) + min(max(p.x, p.y), 0.0) - r;
  return clamp(0.5 - d, 0.0, 1.0);
}

@fragment
fn main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let st = fitted(uv, u.imageSize);
  let sb = fitted(uv, u.imageToSize);
  let a = textureSample(image, imageSampler, st);
  let b = textureSample(imageTo, imageToSampler, sb);
  let pa = vec4f(a.rgb * a.a, a.a) * inside(st);
  let pb = vec4f(b.rgb * b.a, b.a) * inside(sb);
  return mix(pa, pb, u.planeMorph) * rounded(uv) * u.planeOpacity;
}
`

export const PLANE_GLSL = `#version 300 es
precision highp float;

uniform vec2 u_planeSize;
uniform vec2 u_imageSize;
uniform vec2 u_imageToSize;
uniform float u_planeOpacity;
uniform float u_planeRadius;
uniform float u_planeFit;
uniform float u_planeMorph;
uniform sampler2D u_image;
uniform sampler2D u_imageTo;

in vec2 v_uv;
out vec4 fragColor;

vec2 fitted(vec2 uv, vec2 size) {
  if (u_planeFit < 0.5) return uv;
  vec2 ratio = u_planeSize / size;
  float scale = u_planeFit > 1.5 ? min(ratio.x, ratio.y) : max(ratio.x, ratio.y);
  vec2 span = size * scale / u_planeSize;
  return (uv - 0.5) / span + 0.5;
}

float inside(vec2 st) {
  return step(0.0, st.x) * step(st.x, 1.0) * step(0.0, st.y) * step(st.y, 1.0);
}

float rounded(vec2 uv) {
  float r = min(u_planeRadius, min(u_planeSize.x, u_planeSize.y) * 0.5);
  vec2 p = abs((uv - 0.5) * u_planeSize) - (u_planeSize * 0.5 - r);
  float d = length(max(p, vec2(0.0))) + min(max(p.x, p.y), 0.0) - r;
  return clamp(0.5 - d, 0.0, 1.0);
}

void main() {
  vec2 st = fitted(v_uv, u_imageSize);
  vec2 sb = fitted(v_uv, u_imageToSize);
  vec4 a = texture(u_image, st);
  vec4 b = texture(u_imageTo, sb);
  vec4 pa = vec4(a.rgb * a.a, a.a) * inside(st);
  vec4 pb = vec4(b.rgb * b.a, b.a) * inside(sb);
  fragColor = mix(pa, pb, u_planeMorph) * rounded(v_uv) * u_planeOpacity;
}`
