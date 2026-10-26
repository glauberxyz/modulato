import {
  areaOf,
  type BackendImpl,
  collect,
  isData,
  type PassInfo,
  PLANE_UNIFORMS,
  scissorOf,
  sourceSize,
  type Surface,
  type UniformStore,
  warnOnce,
} from './common'
import { aliases, pickFragment, toNumbers, toShader } from './shader'
import type {
  Pass,
  PassOptions,
  Shader,
  Target,
  TargetOptions,
  Texture,
  TextureOptions,
  TextureSource,
  UniformValue,
} from './types'

/**
 * The framework's vertex stage: a quad placed by `u_modulatoArea` (clip-space
 * left, bottom, right, top — the whole target unless a draw names a rect),
 * with `v_uv` running 0→1 left to right and BOTTOM to top across it. A pass
 * that brings GLSL from an existing site usually expects exactly this.
 */
const VERTEX_300 = `#version 300 es
in vec2 a_position;
uniform vec4 u_modulatoArea;
out vec2 v_uv;
void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(mix(u_modulatoArea.xy, u_modulatoArea.zw, v_uv), 0.0, 1.0);
}`

/** The same, for a GLSL ES 1.00 fragment shader (WebGL1-era, `gl_FragColor`). */
const VERTEX_100 = `attribute vec2 a_position;
uniform vec4 u_modulatoArea;
varying vec2 v_uv;
void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(mix(u_modulatoArea.xy, u_modulatoArea.zw, v_uv), 0.0, 1.0);
}`

interface GLTexture extends Texture {
  readonly handle: WebGLTexture
}

interface Program {
  program: WebGLProgram
  /** The framework's rect uniform; absent under a custom vertex shader. */
  area: WebGLUniformLocation | null
  uniforms: Map<string, { location: WebGLUniformLocation; type: number }>
  /** Sampler name → texture unit. */
  samplers: Map<string, number>
}

export function createWebGL2(
  canvas: HTMLCanvasElement,
  alpha: boolean,
  surface: Surface,
): BackendImpl | null {
  const context = canvas.getContext('webgl2', { antialias: false, alpha })
  if (!context) return null
  const gl: WebGL2RenderingContext = context

  const triangle = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, triangle)
  // Two shapes in one buffer. Vertices 0–2: ONE triangle covering clip space,
  // for whole-target draws — the exact geometry GL code has always used, so a
  // ported shader rasterizes bit-for-bit as it did (a two-triangle quad
  // interpolates `v_uv` a hair differently along its diagonal). Vertices 3–8:
  // a quad, for rect draws, where the area must be exact. A custom `vertex`
  // shader gets these corners in `a_position` unchanged.
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 3, -1, -1, 3, -1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    gl.STATIC_DRAW,
  )
  const vao = gl.createVertexArray()
  gl.bindVertexArray(vao)
  gl.enableVertexAttribArray(0)
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
  gl.bindVertexArray(null)

  const textures = new Set<GLTexture>()
  const targets = new Set<GLTarget>()
  const passes = new Set<{ info(): PassInfo; dispose(): void }>()

  const SIZES: Record<number, number> = {
    [gl.FLOAT]: 1, [gl.FLOAT_VEC2]: 2, [gl.FLOAT_VEC3]: 3, [gl.FLOAT_VEC4]: 4,
    [gl.INT]: 1, [gl.INT_VEC2]: 2, [gl.INT_VEC3]: 3, [gl.INT_VEC4]: 4,
    [gl.UNSIGNED_INT]: 1, [gl.BOOL]: 1, [gl.BOOL_VEC2]: 2, [gl.BOOL_VEC3]: 3, [gl.BOOL_VEC4]: 4,
  }
  const INTS = new Set<number>([
    gl.INT, gl.INT_VEC2, gl.INT_VEC3, gl.INT_VEC4,
    gl.BOOL, gl.BOOL_VEC2, gl.BOOL_VEC3, gl.BOOL_VEC4,
  ])
  const SAMPLERS = new Set<number>([gl.SAMPLER_2D])

  function compile(fragment: Shader, vertex: Shader | null): Program | string {
    const vertexCode =
      vertex?.code ?? (/^\s*#version\s+300\s+es/.test(fragment.code) ? VERTEX_300 : VERTEX_100)
    const build = (type: number, code: string) => {
      const shader = gl.createShader(type)!
      gl.shaderSource(shader, code)
      gl.compileShader(shader)
      if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader
      const log = gl.getShaderInfoLog(shader) ?? 'compile failed'
      gl.deleteShader(shader)
      return log
    }
    const vs = build(gl.VERTEX_SHADER, vertexCode)
    const fs = build(gl.FRAGMENT_SHADER, fragment.code)
    if (typeof vs === 'string' || typeof fs === 'string') {
      if (typeof vs !== 'string') gl.deleteShader(vs)
      if (typeof fs !== 'string') gl.deleteShader(fs)
      // Drivers end the log with a NUL and name no file; say which one.
      const log = (typeof fs === 'string' ? fs : vs as string).replace(/\0/g, '').trim()
      const file = typeof fs === 'string' ? (fragment.id ?? 'GLSL') : (vertex?.id ?? 'vertex')
      return `${file}: ${log}`
    }
    const program = gl.createProgram()!
    gl.attachShader(program, vs)
    gl.attachShader(program, fs)
    gl.bindAttribLocation(program, 0, 'a_position')
    gl.linkProgram(program)
    gl.deleteShader(vs)
    gl.deleteShader(fs)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const log = (gl.getProgramInfoLog(program) ?? 'link failed').replace(/\0/g, '').trim()
      gl.deleteProgram(program)
      return `${fragment.id ?? 'GLSL'}: link: ${log}`
    }

    const uniforms: Program['uniforms'] = new Map()
    const samplers: Program['samplers'] = new Map()
    const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS) as number
    gl.useProgram(program)
    for (let i = 0; i < count; i++) {
      const active = gl.getActiveUniform(program, i)
      if (!active) continue
      const name = active.name.replace(/\[0\]$/, '')
      const location = gl.getUniformLocation(program, active.name)
      if (!location) continue
      if (SAMPLERS.has(active.type)) {
        const unit = samplers.size
        samplers.set(name, unit)
        gl.uniform1i(location, unit)
      } else if (name !== 'u_modulatoArea') {
        uniforms.set(name, { location, type: active.type })
      }
    }
    return { program, area: gl.getUniformLocation(program, 'u_modulatoArea'), uniforms, samplers }
  }

  function upload(prog: Program, name: string, value: UniformValue) {
    const key = aliases(name).find((n) => prog.uniforms.has(n))
    // An unused uniform is compiled out, so "not in the program" is normal —
    // only a name the source never mentions at all is worth a warning.
    if (!key) return false
    const { location, type } = prog.uniforms.get(key)!
    const size = SIZES[type]
    const numbers = size ? toNumbers(value, size) : null
    if (!numbers) {
      warnOnce(`uniform \`${key}\` can't take ${JSON.stringify(value)}.`)
      return true
    }
    if (INTS.has(type)) {
      const ints = numbers.map(Math.round)
      if (size === 1) gl.uniform1i(location, ints[0])
      else if (size === 2) gl.uniform2iv(location, ints)
      else if (size === 3) gl.uniform3iv(location, ints)
      else gl.uniform4iv(location, ints)
    } else if (type === gl.UNSIGNED_INT) {
      gl.uniform1ui(location, Math.max(0, Math.round(numbers[0])))
    } else if (size === 1) gl.uniform1f(location, numbers[0])
    else if (size === 2) gl.uniform2fv(location, numbers)
    else if (size === 3) gl.uniform3fv(location, numbers)
    else gl.uniform4fv(location, numbers)
    return true
  }

  function applyOptions(options: TextureOptions, mipmaps: boolean) {
    const linear = (options.filter ?? 'linear') === 'linear'
    const wrap =
      options.wrap === 'repeat' ? gl.REPEAT : options.wrap === 'mirror' ? gl.MIRRORED_REPEAT : gl.CLAMP_TO_EDGE
    gl.texParameteri(
      gl.TEXTURE_2D,
      gl.TEXTURE_MIN_FILTER,
      mipmaps
        ? linear ? gl.LINEAR_MIPMAP_LINEAR : gl.NEAREST_MIPMAP_NEAREST
        : linear ? gl.LINEAR : gl.NEAREST,
    )
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, linear ? gl.LINEAR : gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap)
  }

  function texture(source: TextureSource, options: TextureOptions = {}): GLTexture {
    const handle = gl.createTexture()!
    let width = 0
    let height = 0
    const tex: GLTexture = {
      handle,
      get width() {
        return width
      },
      get height() {
        return height
      },
      update(next) {
        const size = sourceSize(next)
        gl.bindTexture(gl.TEXTURE_2D, handle)
        const same = size.width === width && size.height === height
        if (isData(next)) {
          if (same)
            gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, size.width, size.height, gl.RGBA, gl.UNSIGNED_BYTE, next.data)
          else
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, size.width, size.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, next.data)
        } else {
          gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, options.flipY ?? true)
          if (same) gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, next)
          else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, next)
          gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
        }
        width = size.width
        height = size.height
        if (options.mipmaps) gl.generateMipmap(gl.TEXTURE_2D)
        applyOptions(options, !!options.mipmaps)
        surface.dirty = true
      },
      dispose() {
        gl.deleteTexture(handle)
        textures.delete(tex)
      },
    }
    tex.update(source)
    textures.add(tex)
    return tex
  }

  interface GLTarget extends Target, GLTexture {
    readonly framebuffer: WebGLFramebuffer
    allocate(): void
  }

  function target(options: TargetOptions = {}): Target {
    const scale = options.scale ?? 1
    const handle = gl.createTexture()!
    const framebuffer = gl.createFramebuffer()!
    let width = 0
    let height = 0
    const t: GLTarget = {
      handle,
      framebuffer,
      scale,
      get width() {
        return width
      },
      get height() {
        return height
      },
      allocate() {
        const w = Math.max(1, Math.round(surface.width * scale))
        const h = Math.max(1, Math.round(surface.height * scale))
        if (w === width && h === height) return
        width = w
        height = h
        gl.bindTexture(gl.TEXTURE_2D, handle)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
        applyOptions({ filter: options.filter }, false)
        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, handle, 0)
        gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      },
      update() {
        warnOnce('a target is drawn into, not uploaded to — update() does nothing.')
      },
      dispose() {
        gl.deleteFramebuffer(framebuffer)
        gl.deleteTexture(handle)
        targets.delete(t)
      },
    }
    t.allocate()
    targets.add(t)
    return t
  }

  async function pass(options: PassOptions): Promise<Pass> {
    const fragment = pickFragment(options.fragment, 'webgl2')
    const vertex = options.vertex ? toShader(options.vertex) : null
    let compiledAt = { fragment: fragment.version, vertex: vertex?.version ?? 0 }
    const values: UniformStore = new Map()
    const bound = new Map<string, GLTexture>()
    let error: string | null = null

    let prog: Program | null = null
    const first = compile(fragment, vertex)
    if (typeof first === 'string') {
      error = first
      console.error(`[modulato/gpu] ${first}`)
    } else prog = first

    const self: Pass & { info(): PassInfo } = {
      set(nameOrValues: string | Readonly<Record<string, unknown>>, value?: UniformValue) {
        collect(values, nameOrValues, value)
        return self
      },
      texture(name, tex) {
        bound.set(name, tex as GLTexture)
        return self
      },
      get error() {
        return error
      },
      draw(drawOptions = {}) {
        if (surface.resize()) for (const t of targets) t.allocate()
        // Hot reload: the shader object is the one the import handed us, and
        // dev re-evaluation bumps its version in place. Swap only on success —
        // a typo mid-edit keeps the last good program drawing.
        if (
          fragment.version !== compiledAt.fragment ||
          (vertex && vertex.version !== compiledAt.vertex)
        ) {
          compiledAt = { fragment: fragment.version, vertex: vertex?.version ?? 0 }
          const next = compile(fragment, vertex)
          if (typeof next === 'string') {
            error = next
            console.error(`[modulato/gpu] ${next}`)
          } else {
            if (prog) gl.deleteProgram(prog.program)
            prog = next
            error = null
          }
        }
        if (!prog) return
        const into = options.target as GLTarget | undefined
        const width = into ? into.width : surface.width
        const height = into ? into.height : surface.height
        const scissor = drawOptions.clip ? scissorOf(drawOptions.clip, surface, width, height) : null
        if (drawOptions.clip && !scissor) return
        gl.bindFramebuffer(gl.FRAMEBUFFER, into ? into.framebuffer : null)
        gl.viewport(0, 0, width, height)
        if (scissor) {
          gl.enable(gl.SCISSOR_TEST)
          // GL counts scissor rows from the bottom.
          gl.scissor(scissor.x, height - scissor.y - scissor.height, scissor.width, scissor.height)
        }
        if (options.blend === 'alpha') {
          gl.enable(gl.BLEND)
          gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
        }
        gl.useProgram(prog.program)
        gl.bindVertexArray(vao)
        if (prog.area) gl.uniform4fv(prog.area, areaOf(drawOptions.rect, surface))
        else if (drawOptions.rect) warnOnce('a custom `vertex` shader places itself — `rect` is ignored.')
        for (const [name, value] of values) {
          if (
            !upload(prog, name, value) &&
            !PLANE_UNIFORMS.has(name) &&
            !aliases(name).some((n) => fragment.code.includes(n))
          )
            warnOnce(`${fragment.id ?? 'shader'} has no uniform \`${name}\` (or \`${aliases(name)[1]}\`).`)
        }
        for (const [name, tex] of bound) {
          const key = aliases(name).find((n) => prog!.samplers.has(n))
          if (key === undefined) {
            if (!PLANE_UNIFORMS.has(name) && !aliases(name).some((n) => fragment.code.includes(n)))
              warnOnce(`${fragment.id ?? 'shader'} has no sampler \`${name}\`.`)
            continue
          }
          gl.activeTexture(gl.TEXTURE0 + prog.samplers.get(key)!)
          gl.bindTexture(gl.TEXTURE_2D, tex.handle)
        }
        if (drawOptions.rect) gl.drawArrays(gl.TRIANGLES, 3, 6)
        else gl.drawArrays(gl.TRIANGLES, 0, 3)
        gl.bindVertexArray(null)
        gl.disable(gl.SCISSOR_TEST)
        gl.disable(gl.BLEND)
        // Only a draw onto the canvas puts a new frame on screen; a target is
        // an intermediate the canvas pass has yet to read.
        if (!into) {
          surface.dirty = false
          surface.drawn()
        }
      },
      info() {
        return {
          shader: fragment.id ?? 'inline',
          lang: 'glsl',
          error,
          uniforms: Object.fromEntries(values),
          textures: [...bound.keys()],
        }
      },
      dispose() {
        if (prog) gl.deleteProgram(prog.program)
        prog = null
        passes.delete(self)
      },
    }
    passes.add(self)
    return self
  }

  return {
    pass,
    texture,
    target,
    clear() {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      gl.viewport(0, 0, surface.width, surface.height)
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
    },
    resized() {
      for (const t of targets) t.allocate()
    },
    describe() {
      return [...passes].map((p) => p.info())
    },
    dispose() {
      for (const p of [...passes]) p.dispose()
      for (const t of [...textures]) t.dispose()
      for (const t of [...targets]) t.dispose()
      gl.deleteVertexArray(vao)
      gl.deleteBuffer(triangle)
    },
  }
}
