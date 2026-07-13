import { useEffect, useRef } from 'react'
import { resolveTokens, useTicker } from 'modulato'
import tokens from './motion'

/**
 * Full-viewport background: an array of squares rotating infinitely, printed
 * through a CMYK-style halftone dot screen (paper stock, warm-gray ink, a
 * sparse black key plate, print grain). Hand-rolled WebGL — Paper Shaders'
 * HalftoneCmyk only accepts a static image, so a live animated source needs
 * its own fragment shader. Runs on the framework ticker; the `scene` motion
 * tokens (speed, halftone dot size, square grid scale) are tweakable live.
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
    const uCell = gl.getUniformLocation(program, 'u_cell')
    const uMask = gl.getUniformLocation(program, 'u_mask')

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const resize = () => {
      canvas.width = Math.round(canvas.clientWidth * dpr)
      canvas.height = Math.round(canvas.clientHeight * dpr)
      gl.viewport(0, 0, canvas.width, canvas.height)
    }
    resize()
    window.addEventListener('resize', resize)

    renderRef.current = (timeMs) => {
      const { speed, dot, cell, maskY, maskIn, maskOut } = resolveTokens(tokens).scene
      gl.uniform2f(uResolution, canvas.width, canvas.height)
      gl.uniform1f(uTime, (timeMs / 1000) * speed)
      gl.uniform1f(uDot, dot * dpr)
      gl.uniform1f(uCell, cell)
      gl.uniform3f(uMask, maskY, maskIn, maskOut)
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
uniform float u_dot;   /* halftone screen cell, in device px */
uniform float u_cell;  /* squares grid cell, in viewport-height units */
uniform vec3 u_mask;   /* clear zone: center y fraction, inner r, outer r */

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

mat2 rot(float a) {
  float c = cos(a), s = sin(a);
  return mat2(c, -s, s, c);
}

float sdBox(vec2 p, vec2 b) {
  vec2 d = abs(p) - b;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}

/* Square-outline ink coverage for one grid layer. */
float squares(vec2 uv, float t) {
  vec2 g = uv / u_cell;
  vec2 id = floor(g);
  vec2 lp = (fract(g) - 0.5) * u_cell;

  float phase = (id.x + id.y) * 0.55 + hash(id) * 1.3;
  vec2 p = rot(t * 0.22 + phase) * lp;

  float side = u_cell * (0.26 + 0.10 * hash(id.yx));
  float d = abs(sdBox(p, vec2(side)));
  float w = u_cell * 0.028; /* stroke half-width */
  return 1.0 - smoothstep(w * 0.4, w, d);
}

/* Round-dot halftone screen at a given angle. */
float halftone(vec2 px, float angle, float ink) {
  vec2 q = rot(angle) * px / u_dot;
  vec2 f = fract(q) - 0.5;
  float r = sqrt(clamp(ink, 0.0, 1.0)) * 0.68;
  return smoothstep(r, r - 0.18, length(f));
}

void main() {
  vec2 px = v_uv * u_resolution;
  vec2 uv = (px - 0.5 * u_resolution) / u_resolution.y;

  /* Two square fields drifting at different rates — a loose, layered array. */
  float inkA = squares(uv + vec2(0.13, 0.07), u_time);
  float inkB = squares(rot(0.35) * uv * 1.6 + vec2(4.7, 2.3), -u_time * 0.7) * 0.6;

  /* Readability: lift ink away from the bottom-center text column. */
  vec2 m = (px - vec2(0.5, u_mask.x) * u_resolution) / u_resolution.y;
  float clearZone = smoothstep(u_mask.y, u_mask.z, length(m * vec2(0.85, 1.1)));
  float gray = (inkA * 0.85 + inkB * 0.5) * clearZone;
  float key = inkA * inkA * step(0.72, hash(floor(uv / u_cell) + 5.0)) * clearZone;

  /* Print plates: warm gray at 15deg, black key at 45deg. */
  float dotGray = halftone(px, 0.2618, gray);
  float dotKey = halftone(px, 0.7854, key * 0.8);

  vec3 paper = vec3(0.949, 0.945, 0.910); /* #f2f1e8 */
  vec3 ink   = vec3(0.478, 0.478, 0.459); /* #7a7a75 */
  vec3 black = vec3(0.137, 0.122, 0.125); /* #231f20 */

  vec3 col = paper;
  col = mix(col, ink, dotGray * 0.9);
  col = mix(col, black, dotKey * 0.75);

  /* Print grain. */
  float grain = hash(px + fract(u_time) * 61.7) - 0.5;
  col += grain * 0.05;

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
