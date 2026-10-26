#version 300 es
/*
 * The ring of cuboids the halftone screens: SDF box, one directional light,
 * soft shadows, ambient occlusion. Standard technique, per iquilezles.org.
 * GLSL only — a scene press always runs on WebGL2.
 */
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
}
