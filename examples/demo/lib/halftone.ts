import { HALFTONE_FRAG, SCENE_FRAG, VERT } from './halftone.glsl'

export interface HalftoneUniforms {
  size: number
  contrast: number
  softness: number
  gridNoise: number
  grainOverlay: number
  /** 0 = separate dots, 1 = ink (dots join), 2 = sharp. */
  type: number
  /** Screen angles in degrees: C, M, Y, K. Standard is 15 / 75 / 0 / 45. */
  angles: [number, number, number, number]
  /** Neighbour search radius: 0 = 1x1, 1 = 3x3 (correct), 2 = 5x5. */
  window: number
  /** Per-plate mute, 0 or 1. */
  plates: [number, number, number, number]
  floodK: number
  gains: [number, number, number, number]
  inks: [string, string, string, string]
  paper: string
}

export const DEFAULTS: HalftoneUniforms = {
  size: 0.42,
  contrast: 1.2,
  softness: 0.1,
  gridNoise: 0,
  grainOverlay: 0.12,
  type: 0,
  angles: [15, 75, 0, 45],
  window: 1,
  plates: [1, 1, 1, 1],
  floodK: 0,
  gains: [-0.17, -0.45, -0.45, 0],
  inks: ['#00a0c6', '#d81e78', '#f5c400', '#231f20'],
  paper: '#f4f1ea',
}

export interface SceneUniforms {
  speed: number
  radius: number
  height: number
  count: number
  camHeight: number
  camDist: number
  band: number
  cap: number
}

const rgba = (hex: string): [number, number, number, number] => [
  parseInt(hex.slice(1, 3), 16) / 255,
  parseInt(hex.slice(3, 5), 16) / 255,
  parseInt(hex.slice(5, 7), 16) / 255,
  1,
]

function compile(gl: WebGL2RenderingContext, vertSrc: string, fragSrc: string) {
  const build = (type: number, src: string) => {
    const sh = gl.createShader(type)!
    gl.shaderSource(sh, src)
    gl.compileShader(sh)
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS))
      console.error('[halftone]', gl.getShaderInfoLog(sh))
    return sh
  }
  const prog = gl.createProgram()!
  gl.attachShader(prog, build(gl.VERTEX_SHADER, vertSrc))
  gl.attachShader(prog, build(gl.FRAGMENT_SHADER, fragSrc))
  gl.linkProgram(prog)
  return prog
}

/**
 * A halftone press on a canvas.
 *
 * Source is either the live raymarched scene (rendered into a framebuffer
 * first) or a still image. Either way pass 2 screens it through the CMYK
 * halftone. Nothing here owns a RAF — call `render()` from the framework
 * ticker so the whole site shares one loop (and so Tweak's slow-mo reaches
 * it, since useTicker now runs on the motion clock).
 */
export function createHalftone(
  canvas: HTMLCanvasElement,
  opts: { source: 'scene' | 'image'; image?: HTMLImageElement } = { source: 'scene' },
) {
  const gl = canvas.getContext('webgl2', { antialias: false, alpha: true })
  if (!gl) return null

  const halftoneProg = compile(gl, VERT, HALFTONE_FRAG)
  const sceneProg = opts.source === 'scene' ? compile(gl, VERT, SCENE_FRAG) : null

  const quad = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, quad)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
  const bind = (prog: WebGLProgram) => {
    const loc = gl.getAttribLocation(prog, 'a_position')
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
  }
  const u = (prog: WebGLProgram, name: string) => gl.getUniformLocation(prog, name)

  // Static noise for the grid jitter (Paper's randomRG).
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

  const sourceTex = gl.createTexture()
  const fbo = opts.source === 'scene' ? gl.createFramebuffer() : null
  let imageAspect = 1

  if (opts.source === 'image' && opts.image) {
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, sourceTex)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, opts.image)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    imageAspect = opts.image.naturalWidth / opts.image.naturalHeight
  }

  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const resize = () => {
    const w = Math.max(1, Math.round(canvas.clientWidth * dpr))
    const h = Math.max(1, Math.round(canvas.clientHeight * dpr))
    if (canvas.width === w && canvas.height === h) return
    canvas.width = w
    canvas.height = h
    if (opts.source === 'scene') {
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, sourceTex)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, sourceTex, 0)
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      imageAspect = w / h
    }
  }
  resize()
  const observer = new ResizeObserver(resize)
  observer.observe(canvas)

  return {
    render(timeMs: number, h: HalftoneUniforms, scene?: SceneUniforms) {
      resize()
      if (opts.source === 'scene' && sceneProg && scene) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
        gl.viewport(0, 0, canvas.width, canvas.height)
        gl.useProgram(sceneProg)
        bind(sceneProg)
        gl.uniform2f(u(sceneProg, 'u_resolution'), canvas.width, canvas.height)
        gl.uniform1f(u(sceneProg, 'u_time'), (timeMs / 1000) * scene.speed)
        gl.uniform3f(u(sceneProg, 'u_ring'), scene.radius, scene.height, scene.count)
        gl.uniform2f(u(sceneProg, 'u_cam'), scene.camHeight, scene.camDist)
        gl.uniform1f(u(sceneProg, 'u_band'), scene.band)
        gl.uniform1f(u(sceneProg, 'u_cap'), scene.cap)
        gl.drawArrays(gl.TRIANGLES, 0, 3)
      }

      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      gl.viewport(0, 0, canvas.width, canvas.height)
      gl.useProgram(halftoneProg)
      bind(halftoneProg)
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, sourceTex)
      gl.uniform1i(u(halftoneProg, 'u_image'), 0)
      gl.activeTexture(gl.TEXTURE1)
      gl.bindTexture(gl.TEXTURE_2D, noiseTex)
      gl.uniform1i(u(halftoneProg, 'u_noiseTexture'), 1)
      gl.uniform1f(u(halftoneProg, 'u_imageAspectRatio'), imageAspect)
      gl.uniform4f(u(halftoneProg, 'u_colorBack'), ...rgba(h.paper))
      gl.uniform4f(u(halftoneProg, 'u_colorC'), ...rgba(h.inks[0]))
      gl.uniform4f(u(halftoneProg, 'u_colorM'), ...rgba(h.inks[1]))
      gl.uniform4f(u(halftoneProg, 'u_colorY'), ...rgba(h.inks[2]))
      gl.uniform4f(u(halftoneProg, 'u_colorK'), ...rgba(h.inks[3]))
      gl.uniform1f(u(halftoneProg, 'u_size'), h.size)
      gl.uniform1f(u(halftoneProg, 'u_contrast'), h.contrast)
      gl.uniform1f(u(halftoneProg, 'u_softness'), h.softness)
      gl.uniform1f(u(halftoneProg, 'u_gridNoise'), h.gridNoise)
      gl.uniform1f(u(halftoneProg, 'u_grainOverlay'), h.grainOverlay)
      gl.uniform1f(u(halftoneProg, 'u_type'), h.type)
      gl.uniform4f(u(halftoneProg, 'u_angles'), ...h.angles)
      gl.uniform1f(u(halftoneProg, 'u_window'), h.window)
      gl.uniform4f(u(halftoneProg, 'u_plates'), ...h.plates)
      gl.uniform1f(u(halftoneProg, 'u_floodC'), 0)
      gl.uniform1f(u(halftoneProg, 'u_floodM'), 0)
      gl.uniform1f(u(halftoneProg, 'u_floodY'), 0)
      gl.uniform1f(u(halftoneProg, 'u_floodK'), h.floodK)
      gl.uniform1f(u(halftoneProg, 'u_gainC'), h.gains[0])
      gl.uniform1f(u(halftoneProg, 'u_gainM'), h.gains[1])
      gl.uniform1f(u(halftoneProg, 'u_gainY'), h.gains[2])
      gl.uniform1f(u(halftoneProg, 'u_gainK'), h.gains[3])
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    },
    dispose() {
      observer.disconnect()
    },
  }
}

/** Beat wavelength between two screens, in cells — the moiré readout. */
export function beatCells(a: number, b: number): number {
  let d = Math.abs(a - b) % 90
  if (d > 45) d = 90 - d
  if (d < 0.01) return Infinity
  return 1 / (2 * Math.sin((d * Math.PI) / 180 / 2))
}
