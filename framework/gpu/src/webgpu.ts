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
import { aliases, pickFragment, toNumbers } from './shader'
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
import { type Binding, reflect, type Reflection } from './wgsl'

/*
 * WebGPU's types are not in every TypeScript a Modulato site runs — TS 5's
 * lib.dom has none of them, and this package ships as source that the SITE
 * typechecks. So the slice of the API used here is described locally rather
 * than borrowed from a lib or @webgpu/types (which would collide with TS 7's
 * own). Descriptors stay loosely typed; the browser validates them anyway.
 */
type Desc = Record<string, unknown>
interface GPUDeviceLike {
  queue: {
    writeBuffer(buffer: unknown, offset: number, data: ArrayBuffer): void
    writeTexture(dest: Desc, data: Uint8Array, layout: Desc, size: Desc): void
    copyExternalImageToTexture(source: Desc, dest: Desc, size: Desc): void
    submit(commands: unknown[]): void
  }
  lost: Promise<{ message: string; reason?: string }>
  createBuffer(desc: Desc): GPUHandle
  createTexture(desc: Desc): GPUTextureLike
  createSampler(desc: Desc): GPUHandle
  createShaderModule(desc: Desc): GPUShaderModuleLike
  createBindGroupLayout(desc: Desc): GPUHandle
  createPipelineLayout(desc: Desc): GPUHandle
  createRenderPipeline(desc: Desc): GPUHandle & { getBindGroupLayout(i: number): GPUHandle }
  createBindGroup(desc: Desc): GPUHandle
  createCommandEncoder(): {
    beginRenderPass(desc: Desc): {
      setPipeline(p: unknown): void
      setBindGroup(i: number, g: unknown): void
      setScissorRect(x: number, y: number, w: number, h: number): void
      draw(vertexCount: number, instanceCount?: number, firstVertex?: number): void
      end(): void
    }
    finish(): unknown
  }
  pushErrorScope(filter: string): void
  popErrorScope(): Promise<{ message: string } | null>
}
interface GPUHandle {
  destroy?(): void
}
interface GPUTextureLike extends GPUHandle {
  createView(desc?: Desc): unknown
}
interface GPUShaderModuleLike {
  getCompilationInfo(): Promise<{
    messages: readonly { type: string; message: string; lineNum: number; linePos: number }[]
  }>
}
interface GPUCanvasContextLike {
  configure(desc: Desc): void
  unconfigure(): void
  getCurrentTexture(): GPUTextureLike
}
interface NavigatorGPU {
  requestAdapter(options?: Desc): Promise<{ requestDevice(desc?: Desc): Promise<GPUDeviceLike> } | null>
  getPreferredCanvasFormat(): string
}

// Spec-fixed flag values (GPUBufferUsage / GPUTextureUsage / GPUShaderStage),
// spelled out so they need no global.
const BUFFER_UNIFORM = 0x40
const BUFFER_COPY_DST = 0x8
const TEXTURE_COPY_DST = 0x2
const TEXTURE_BINDING = 0x4
const TEXTURE_RENDER = 0x10
const STAGE_VERTEX = 0x1
const STAGE_FRAGMENT = 0x2

export function gpuNavigator(): NavigatorGPU | null {
  if (typeof navigator === 'undefined') return null
  return (navigator as unknown as { gpu?: NavigatorGPU }).gpu ?? null
}

/**
 * ONE device for the whole page. Every surface draws through it, which is the
 * quiet advantage over WebGL: a page of a dozen canvases is a dozen contexts
 * there, and browsers start dropping the oldest at around sixteen.
 */
let devicePromise: Promise<GPUDeviceLike | null> | null = null
export function requestDevice(): Promise<GPUDeviceLike | null> {
  devicePromise ??= (async () => {
    const gpu = gpuNavigator()
    if (!gpu) return null
    try {
      const adapter = await gpu.requestAdapter()
      if (!adapter) return null
      const device = await adapter.requestDevice()
      void device.lost.then((info) => {
        // Let the next surface ask again instead of holding a dead device.
        devicePromise = null
        if (info.reason !== 'destroyed') console.error(`[modulato/gpu] WebGPU device lost: ${info.message}`)
      })
      return device
    } catch {
      return null
    }
  })()
  return devicePromise
}

/**
 * The framework's vertex stage, the WGSL twin of the GLSL one: a quad placed
 * by `area` (clip-space left, bottom, right, top — the whole target unless a
 * draw names a rect), `uv` 0→1 left to right and BOTTOM to top across it.
 * `area` lives in group 1, which is the framework's; group 0 is the shader's.
 *
 * `vs_target` writes the same picture upside down. A render target's row 0 is
 * the top of what was drawn, and a texture's v = 0 is its row 0, so drawing
 * into a target the plain way and sampling it back reads the picture flipped.
 * Flipping on the way IN keeps "v = 0 is the bottom" true for every texture —
 * images, data and targets alike — which is what GLSL code already assumes.
 */
const VERTEX = /* wgsl */ `
struct VOut { @builtin(position) position: vec4f, @location(0) uv: vec2f }
@group(1) @binding(0) var<uniform> area: vec4f;
// Vertices 0–2: one triangle covering the area, for whole-target draws (the
// geometry the GLSL side uses, so the two rasterize alike). 3–8: a quad, for
// rect draws.
fn corner(i: u32) -> vec2f {
  var c = array<vec2f, 9>(
    vec2f(0.0, 0.0), vec2f(2.0, 0.0), vec2f(0.0, 2.0),
    vec2f(0.0, 0.0), vec2f(1.0, 0.0), vec2f(0.0, 1.0),
    vec2f(0.0, 1.0), vec2f(1.0, 0.0), vec2f(1.0, 1.0),
  );
  return c[i];
}
@vertex fn vs(@builtin(vertex_index) i: u32) -> VOut {
  let c = corner(i);
  return VOut(vec4f(mix(area.xy, area.zw, c), 0.0, 1.0), c);
}
@vertex fn vs_target(@builtin(vertex_index) i: u32) -> VOut {
  let c = corner(i);
  let p = mix(area.xy, area.zw, c);
  return VOut(vec4f(p.x, -p.y, 0.0, 1.0), c);
}`

/** A plain covering triangle, written flipped — for building mip levels. */
const BLIT_VERTEX = /* wgsl */ `
struct VOut { @builtin(position) position: vec4f, @location(0) uv: vec2f }
@vertex fn vs(@builtin(vertex_index) i: u32) -> VOut {
  var p = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0));
  return VOut(vec4f(p[i].x, -p[i].y, 0.0, 1.0), p[i] * 0.5 + 0.5);
}`

const BLIT = /* wgsl */ `
@group(0) @binding(0) var source: texture_2d<f32>;
@group(0) @binding(1) var linearSampler: sampler;
@fragment fn main(@location(0) uv: vec2f) -> @location(0) vec4f {
  return textureSampleLevel(source, linearSampler, uv, 0.0);
}`

interface GPUTex extends Texture {
  view(): unknown
  sampler(): GPUHandle
}

interface GPUTarget extends Target, GPUTex {
  allocate(): void
}

export async function createWebGPU(
  canvas: HTMLCanvasElement,
  alpha: boolean,
  surface: Surface,
): Promise<BackendImpl | null> {
  const device = await requestDevice()
  const nav = gpuNavigator()
  if (!device || !nav) return null
  const context = canvas.getContext('webgpu') as unknown as GPUCanvasContextLike | null
  if (!context) return null
  const format = nav.getPreferredCanvasFormat()
  context.configure({ device, format, alphaMode: alpha ? 'premultiplied' : 'opaque' })

  const vertexModule = device.createShaderModule({ code: VERTEX })
  const areaLayout = device.createBindGroupLayout({
    entries: [{ binding: 0, visibility: STAGE_VERTEX, buffer: { type: 'uniform' } }],
  })
  const textures = new Set<GPUTex>()
  const targets = new Set<GPUTarget>()
  const passes = new Set<{ info(): PassInfo; dispose(): void }>()

  const samplerCache = new Map<string, GPUHandle>()
  function samplerFor(options: TextureOptions, mipmaps: boolean): GPUHandle {
    const filter = options.filter ?? 'linear'
    const wrap = options.wrap === 'repeat' ? 'repeat' : options.wrap === 'mirror' ? 'mirror-repeat' : 'clamp-to-edge'
    const key = `${filter}|${wrap}|${mipmaps}`
    let s = samplerCache.get(key)
    if (!s) {
      s = device!.createSampler({
        magFilter: filter,
        minFilter: filter,
        mipmapFilter: mipmaps ? filter : 'nearest',
        addressModeU: wrap,
        addressModeV: wrap,
      })
      samplerCache.set(key, s)
    }
    return s
  }

  // Mip chains are built by drawing each level from the one above it — WebGPU
  // has no generateMipmap(). Built lazily: most sites never ask for mips.
  let blit: { pipeline: ReturnType<GPUDeviceLike['createRenderPipeline']> } | null = null
  function buildMips(texture: GPUTextureLike, levels: number) {
    blit ??= {
      pipeline: device!.createRenderPipeline({
        layout: 'auto',
        vertex: { module: device!.createShaderModule({ code: BLIT_VERTEX }), entryPoint: 'vs' },
        fragment: {
          module: device!.createShaderModule({ code: BLIT }),
          entryPoint: 'main',
          targets: [{ format: 'rgba8unorm' }],
        },
        primitive: { topology: 'triangle-list' },
      }),
    }
    const smooth = samplerFor({ filter: 'linear' }, false)
    const encoder = device!.createCommandEncoder()
    for (let level = 1; level < levels; level++) {
      const rp = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: texture.createView({ baseMipLevel: level, mipLevelCount: 1 }),
            loadOp: 'clear',
            storeOp: 'store',
            clearValue: [0, 0, 0, 0],
          },
        ],
      })
      rp.setPipeline(blit.pipeline)
      rp.setBindGroup(
        0,
        device!.createBindGroup({
          layout: blit.pipeline.getBindGroupLayout(0),
          entries: [
            { binding: 0, resource: texture.createView({ baseMipLevel: level - 1, mipLevelCount: 1 }) },
            { binding: 1, resource: smooth },
          ],
        }),
      )
      rp.draw(3)
      rp.end()
    }
    device!.queue.submit([encoder.finish()])
  }

  function texture(source: TextureSource, options: TextureOptions = {}): GPUTex {
    let handle: GPUTextureLike | null = null
    let width = 0
    let height = 0
    let levels = 1
    const tex: GPUTex = {
      get width() {
        return width
      },
      get height() {
        return height
      },
      view() {
        return handle!.createView()
      },
      sampler() {
        return samplerFor(options, levels > 1)
      },
      update(next) {
        const size = sourceSize(next)
        if (!handle || size.width !== width || size.height !== height) {
          handle?.destroy?.()
          width = Math.max(1, size.width)
          height = Math.max(1, size.height)
          levels = options.mipmaps ? Math.floor(Math.log2(Math.max(width, height))) + 1 : 1
          handle = device!.createTexture({
            size: [width, height],
            format: 'rgba8unorm',
            mipLevelCount: levels,
            usage: TEXTURE_BINDING | TEXTURE_COPY_DST | TEXTURE_RENDER,
          })
        }
        if (isData(next)) {
          device!.queue.writeTexture(
            { texture: handle },
            next.data,
            { bytesPerRow: width * 4, rowsPerImage: height },
            { width, height },
          )
        } else {
          device!.queue.copyExternalImageToTexture(
            { source: next, flipY: options.flipY ?? true },
            { texture: handle },
            { width, height },
          )
        }
        if (levels > 1) buildMips(handle, levels)
        surface.dirty = true
      },
      dispose() {
        handle?.destroy?.()
        handle = null
        textures.delete(tex)
      },
    }
    tex.update(source)
    textures.add(tex)
    return tex
  }

  function target(options: TargetOptions = {}): Target {
    const scale = options.scale ?? 1
    let handle: GPUTextureLike | null = null
    let width = 0
    let height = 0
    const t: GPUTarget = {
      scale,
      get width() {
        return width
      },
      get height() {
        return height
      },
      view() {
        return handle!.createView()
      },
      sampler() {
        return samplerFor({ filter: options.filter }, false)
      },
      allocate() {
        const w = Math.max(1, Math.round(surface.width * scale))
        const h = Math.max(1, Math.round(surface.height * scale))
        if (handle && w === width && h === height) return
        handle?.destroy?.()
        width = w
        height = h
        handle = device!.createTexture({
          size: [w, h],
          // The canvas format, so one pipeline can draw into either.
          format,
          usage: TEXTURE_BINDING | TEXTURE_RENDER,
        })
      },
      update() {
        warnOnce('a target is drawn into, not uploaded to — update() does nothing.')
      },
      dispose() {
        handle?.destroy?.()
        handle = null
        targets.delete(t)
      },
    }
    t.allocate()
    targets.add(t)
    return t
  }

  interface Compiled {
    pipeline: ReturnType<GPUDeviceLike['createRenderPipeline']>
    layout: GPUHandle
    reflection: Reflection
    buffers: Map<number, { buffer: GPUHandle; data: ArrayBuffer }>
  }

  const PREMULTIPLIED_OVER = {
    color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
    alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
  }

  type Built = Omit<Compiled, 'buffers'>

  /**
   * Pipelines by source, shared between passes: a page of planes drawing the
   * same shader compiles it once. Uniform buffers stay per pass (see
   * compile), so what one plane sets never leaks into another. A hot edit
   * is new source, so a new entry — the old one is simply never asked for.
   */
  const built = new Map<string, Promise<Built | string>>()

  async function compile(
    shader: Shader,
    intoTarget: boolean,
    blend: boolean,
  ): Promise<Compiled | string> {
    const key = `${intoTarget}|${blend}|${shader.code}`
    let pending = built.get(key)
    if (!pending) {
      pending = build(shader, intoTarget, blend)
      built.set(key, pending)
    }
    const result = await pending
    if (typeof result === 'string') return result
    const buffers: Compiled['buffers'] = new Map()
    for (const b of result.reflection.bindings) {
      if (b.kind !== 'uniform') continue
      buffers.set(b.binding, {
        buffer: device!.createBuffer({ size: b.byteSize, usage: BUFFER_UNIFORM | BUFFER_COPY_DST }),
        data: new ArrayBuffer(b.byteSize),
      })
    }
    return { ...result, buffers }
  }

  async function build(shader: Shader, intoTarget: boolean, blend: boolean): Promise<Built | string> {
    let reflection: Reflection
    try {
      reflection = reflect(shader.code, shader.id ?? 'WGSL')
    } catch (e) {
      return (e as Error).message
    }
    device!.pushErrorScope('validation')
    const module = device!.createShaderModule({ code: shader.code })
    const layout = device!.createBindGroupLayout({
      entries: reflection.bindings.map((b) => ({
        binding: b.binding,
        visibility: STAGE_FRAGMENT,
        ...(b.kind === 'uniform'
          ? { buffer: { type: 'uniform' } }
          : b.kind === 'texture'
            ? { texture: { sampleType: 'float' } }
            : { sampler: { type: 'filtering' } }),
      })),
    })
    const pipeline = device!.createRenderPipeline({
      layout: device!.createPipelineLayout({ bindGroupLayouts: [layout, areaLayout] }),
      vertex: { module: vertexModule, entryPoint: intoTarget ? 'vs_target' : 'vs' },
      fragment: {
        module,
        entryPoint: reflection.entry,
        targets: [blend ? { format, blend: PREMULTIPLIED_OVER } : { format }],
      },
      primitive: { topology: 'triangle-list' },
    })
    const [info, failure] = await Promise.all([module.getCompilationInfo(), device!.popErrorScope()])
    const errors = info.messages.filter((m) => m.type === 'error')
    if (errors.length)
      return errors.map((m) => `${shader.id ?? 'WGSL'}:${m.lineNum}:${m.linePos} ${m.message}`).join('\n')
    if (failure) return failure.message
    return { pipeline, layout, reflection }
  }

  function release(c: Compiled) {
    for (const { buffer } of c.buffers.values()) buffer.destroy?.()
  }

  // A texture for a declared binding the page never filled: one transparent
  // pixel, so the bind group is complete and the draw still happens.
  let blank: GPUTex | null = null

  async function pass(options: PassOptions): Promise<Pass> {
    if (options.vertex) warnOnce('`vertex` is GLSL-only; a WGSL pass uses the framework vertex stage.')
    const fragment = pickFragment(options.fragment, 'webgpu')
    const into = options.target as GPUTarget | undefined
    const values: UniformStore = new Map()
    const bound = new Map<string, GPUTex>()
    let error: string | null = null
    let compiled: Compiled | null = null
    let compiledAt = fragment.version
    let compiling = false
    const blend = options.blend === 'alpha'
    // The rect this pass draws into, rewritten before every draw.
    const areaBuffer = device!.createBuffer({ size: 16, usage: BUFFER_UNIFORM | BUFFER_COPY_DST })
    const areaGroup = device!.createBindGroup({
      layout: areaLayout,
      entries: [{ binding: 0, resource: { buffer: areaBuffer } }],
    })

    const first = await compile(fragment, !!into, blend)
    if (typeof first === 'string') {
      error = first
      console.error(`[modulato/gpu] ${first}`)
    } else compiled = first

    function recompile() {
      compiling = true
      compiledAt = fragment.version
      void compile(fragment, !!into, blend).then((next) => {
        compiling = false
        if (typeof next === 'string') {
          error = next
          console.error(`[modulato/gpu] ${next}`)
          return
        }
        if (compiled) release(compiled)
        compiled = next
        error = null
        // The page may only draw when its inputs change; this is a change.
        surface.dirty = true
      })
    }

    function lookup(bindings: Binding[], name: string, kind: Binding['kind']) {
      const names = aliases(name)
      return bindings.find((b) => b.kind === kind && names.includes(b.name))
    }

    const self: Pass & { info(): PassInfo } = {
      set(nameOrValues: string | Readonly<Record<string, unknown>>, value?: UniformValue) {
        collect(values, nameOrValues, value)
        return self
      },
      texture(name, tex) {
        bound.set(name, tex as GPUTex)
        return self
      },
      get error() {
        return error
      },
      draw(drawOptions = {}) {
        if (surface.resize()) for (const t of targets) t.allocate()
        if (fragment.version !== compiledAt && !compiling) recompile()
        if (!compiled) return
        const c = compiled
        const width = into ? into.width : surface.width
        const height = into ? into.height : surface.height
        const scissor = drawOptions.clip ? scissorOf(drawOptions.clip, surface, width, height) : null
        if (drawOptions.clip && !scissor) return
        device!.queue.writeBuffer(areaBuffer, 0, new Float32Array(areaOf(drawOptions.rect, surface)).buffer)

        // Uniforms: every value the page set, written where the struct says.
        for (const [name, value] of values) {
          const names = aliases(name)
          let found = false
          for (const b of c.reflection.bindings) {
            if (b.kind !== 'uniform') continue
            const field = b.fields.find((f) => names.includes(f.name))
            if (!field) continue
            found = true
            const numbers = toNumbers(value, field.size)
            if (!numbers) {
              warnOnce(`uniform \`${field.name}\` can't take ${JSON.stringify(value)}.`)
              continue
            }
            const { data } = c.buffers.get(b.binding)!
            const View = field.kind === 'f32' ? Float32Array : field.kind === 'i32' ? Int32Array : Uint32Array
            const view = new View(data, field.offset, field.size)
            for (let i = 0; i < field.size; i++)
              view[i] = field.kind === 'f32' ? numbers[i] : Math.round(numbers[i])
          }
          if (!found && !PLANE_UNIFORMS.has(name)) warnOnce(`${fragment.id ?? 'shader'} has no uniform \`${name}\`.`)
        }
        for (const { buffer, data } of c.buffers.values()) device!.queue.writeBuffer(buffer, 0, data)

        const entries = c.reflection.bindings.map((b) => {
          if (b.kind === 'uniform') return { binding: b.binding, resource: { buffer: c.buffers.get(b.binding)!.buffer } }
          if (b.kind === 'texture') {
            const tex = [...bound].find(([name]) => aliases(name).includes(b.name))?.[1]
            if (!tex) {
              warnOnce(`${fragment.id ?? 'shader'}: texture \`${b.name}\` was never given — pass.texture('${b.name}', …).`)
              blank ??= texture({ width: 1, height: 1, data: new Uint8Array(4) })
            }
            return { binding: b.binding, resource: (tex ?? blank!).view() }
          }
          // A sampler named `<texture>Sampler` takes that texture's filter and
          // wrap; any other sampler is linear, clamped.
          const owner = [...bound].find(([name]) =>
            aliases(name).some((n) => `${n}Sampler` === b.name || `${n}_sampler` === b.name),
          )?.[1]
          return { binding: b.binding, resource: owner ? owner.sampler() : samplerFor({}, false) }
        })
        for (const [name] of bound)
          if (!PLANE_UNIFORMS.has(name) && !lookup(c.reflection.bindings, name, 'texture'))
            warnOnce(`${fragment.id ?? 'shader'} has no texture \`${name}\`.`)

        // Each draw is its own submission: a pass drawn several times in a
        // frame (one per plane) gets the uniforms written just before it,
        // because the queue runs writes and submits in order.
        const encoder = device!.createCommandEncoder()
        const rp = encoder.beginRenderPass({
          colorAttachments: [
            {
              view: into ? into.view() : context!.getCurrentTexture().createView(),
              loadOp: !drawOptions.rect && !blend ? 'clear' : 'load',
              storeOp: 'store',
              clearValue: [0, 0, 0, 0],
            },
          ],
        })
        rp.setPipeline(c.pipeline)
        rp.setBindGroup(0, device!.createBindGroup({ layout: c.layout, entries }))
        rp.setBindGroup(1, areaGroup)
        if (scissor) rp.setScissorRect(scissor.x, scissor.y, scissor.width, scissor.height)
        if (drawOptions.rect) rp.draw(6, 1, 3)
        else rp.draw(3)
        rp.end()
        device!.queue.submit([encoder.finish()])
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
          lang: 'wgsl',
          error,
          uniforms: Object.fromEntries(values),
          textures: [...bound.keys()],
        }
      },
      dispose() {
        if (compiled) release(compiled)
        compiled = null
        areaBuffer.destroy?.()
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
      const encoder = device!.createCommandEncoder()
      encoder
        .beginRenderPass({
          colorAttachments: [
            {
              view: context!.getCurrentTexture().createView(),
              loadOp: 'clear',
              storeOp: 'store',
              clearValue: [0, 0, 0, 0],
            },
          ],
        })
        .end()
      device!.queue.submit([encoder.finish()])
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
      blank = null
      context!.unconfigure()
    },
  }
}
