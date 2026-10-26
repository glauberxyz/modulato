// Fig. F — a shape printed by a distance test, two ways. shape.frag is the
// same shader in GLSL; keep the two in step.
//
// Field: `field` is the stencil's signed distance field, worked out when the
// site was built (smile-stencil.svg?sdf): 0.5 on the edge, rising inside,
// falling outside. Keeping what passes `threshold` prints the shape; moving
// it swells and thins the shape the way coverage swells a halftone dot.
//
// Dots: `points` holds the same outline sampled every few units, also at
// build time (smile-stencil.svg?points), packed two 16-bit coordinates to a
// texel. Each pixel finds its nearest point and is ink if it is closer than
// `dotSize` — a screen laid along the shape instead of across a grid.

struct Uniforms {
  resolution: vec2f,
  mode: f32,
  threshold: f32,
  dotSize: f32,
  count: f32,
  spread: f32,
  fieldSize: f32,
  paper: vec3f,
  ink: vec3f,
}

@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var field: texture_2d<f32>;
@group(0) @binding(2) var fieldSampler: sampler;
@group(0) @binding(3) var points: texture_2d<f32>;

const VIEWBOX = 200.0;

// The pixel, in the stencil's viewBox units: the 200-unit square centered
// in the frame with a little air round it, y down like the SVG.
fn shapeSpace(uv: vec2f) -> vec2f {
  let px = uv * u.resolution;
  let scale = min(u.resolution.x, u.resolution.y) / (VIEWBOX * 1.12);
  let p = (px - u.resolution * 0.5) / scale;
  return vec2f(p.x, -p.y) + VIEWBOX * 0.5;
}

fn unpack(t: vec4f) -> vec2f {
  let x = (t.r * 255.0 * 256.0 + t.g * 255.0) / 65535.0;
  let y = (t.b * 255.0 * 256.0 + t.a * 255.0) / 65535.0;
  return vec2f(x, y) * VIEWBOX;
}

@fragment
fn main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let p = shapeSpace(uv);

  // The field texture covers the viewBox plus `spread` pixels of margin on
  // every side, and is stored upside down relative to the SVG (v = 0 is its
  // bottom row).
  let inner = u.fieldSize - 2.0 * u.spread;
  let st = (p / VIEWBOX * inner + u.spread) / u.fieldSize;
  let d = textureSampleLevel(field, fieldSampler, vec2f(st.x, 1.0 - st.y), 0.0).r;

  var coverage: f32;
  if (u.mode < 0.5) {
    let aa = max(fwidth(d), 1e-4);
    coverage = smoothstep(u.threshold - aa, u.threshold + aa, d);
  } else {
    var nearest = 1e9;
    for (var i = 0; i < i32(u.count); i++) {
      nearest = min(nearest, distance(p, unpack(textureLoad(points, vec2i(i, 0), 0))));
    }
    let aa = max(fwidth(nearest), 1e-4);
    coverage = 1.0 - smoothstep(u.dotSize - aa, u.dotSize + aa, nearest);
  }

  // The field itself, faintly, under the print — so what the threshold is
  // cutting through is on the page too. Field mode only: under the dots it
  // reads as a smudge.
  let paper = mix(u.paper, u.ink, 0.1 * d * (1.0 - u.mode));
  return vec4f(mix(paper, u.ink, coverage), 1.0);
}
