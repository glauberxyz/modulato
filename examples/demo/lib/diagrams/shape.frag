#version 300 es
// Fig. F, for browsers without WebGPU — shape.wgsl says what it does.
precision highp float;

uniform vec2 u_resolution;
uniform float u_mode;
uniform float u_threshold;
uniform float u_dotSize;
uniform float u_count;
uniform float u_spread;
uniform float u_fieldSize;
uniform vec3 u_paper;
uniform vec3 u_ink;
uniform sampler2D u_field;
uniform sampler2D u_points;

in vec2 v_uv;
out vec4 fragColor;

const float VIEWBOX = 200.0;

vec2 shapeSpace(vec2 uv) {
  vec2 px = uv * u_resolution;
  float scale = min(u_resolution.x, u_resolution.y) / (VIEWBOX * 1.12);
  vec2 p = (px - u_resolution * 0.5) / scale;
  return vec2(p.x, -p.y) + VIEWBOX * 0.5;
}

vec2 unpack(vec4 t) {
  float x = (t.r * 255.0 * 256.0 + t.g * 255.0) / 65535.0;
  float y = (t.b * 255.0 * 256.0 + t.a * 255.0) / 65535.0;
  return vec2(x, y) * VIEWBOX;
}

void main() {
  vec2 p = shapeSpace(v_uv);

  float inner = u_fieldSize - 2.0 * u_spread;
  vec2 st = (p / VIEWBOX * inner + u_spread) / u_fieldSize;
  float d = texture(u_field, vec2(st.x, 1.0 - st.y)).r;

  float coverage;
  if (u_mode < 0.5) {
    float aa = max(fwidth(d), 1e-4);
    coverage = smoothstep(u_threshold - aa, u_threshold + aa, d);
  } else {
    float nearest = 1e9;
    for (int i = 0; i < int(u_count); i++) {
      nearest = min(nearest, distance(p, unpack(texelFetch(u_points, ivec2(i, 0), 0))));
    }
    float aa = max(fwidth(nearest), 1e-4);
    coverage = 1.0 - smoothstep(u_dotSize - aa, u_dotSize + aa, nearest);
  }

  vec3 paper = mix(u_paper, u_ink, 0.1 * d * (1.0 - u_mode));
  fragColor = vec4(mix(paper, u_ink, coverage), 1.0);
}
