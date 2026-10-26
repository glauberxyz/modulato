import { type BackendImpl, DEV, type PassInfo, type Surface } from './common'
import type { Backend, Gpu, GpuOptions } from './types'
import { createWebGL2 } from './webgl2'
import { createWebGPU, gpuNavigator } from './webgpu'

export interface SurfaceInfo {
  backend: Backend
  canvas: HTMLCanvasElement
  width: number
  height: number
  passes: PassInfo[]
}

interface Registration {
  info(): SurfaceInfo
  capture(): Promise<string>
  invalidate(): void
}

const live = new Set<Registration>()

/**
 * Dev only — what an agent reads to check GPU work it cannot see:
 *
 *   __MODULATO_GPU__.surfaces()   every live surface: backend, size, and per
 *                                 pass the shader, its error, the uniforms
 *                                 it was last given
 *   __MODULATO_GPU__.capture(c)   a PNG data URL of the next frame drawn on
 *                                 canvas `c` (or the nth surface)
 *
 * A capture has to happen inside the task that drew: neither backend keeps
 * the picture around afterwards (that would cost memory on every frame of
 * every site). So it marks the surface dirty — which also wakes a press that
 * only draws on change — and resolves from the next draw.
 */
if (DEV && typeof window !== 'undefined') {
  ;(window as unknown as { __MODULATO_GPU__: unknown }).__MODULATO_GPU__ = {
    surfaces: () => [...live].map((s) => s.info()),
    capture: (which: HTMLCanvasElement | number = 0) => {
      const all = [...live]
      const found =
        typeof which === 'number' ? all[which] : all.find((s) => s.info().canvas === which)
      return found ? found.capture() : Promise.reject(new Error('no live GPU surface there'))
    },
  }
  // A shader file hot-swapped (the @modulato/vite dev module fires this). The
  // pass recompiles on its next draw — so make sure there is one, even on a
  // surface that only draws when its inputs change.
  window.addEventListener('modulato:shader', () => {
    for (const s of live) s.invalidate()
  })
}

function override(): Backend | null {
  if (!DEV || typeof location === 'undefined') return null
  const value = new URLSearchParams(location.search).get('gpu')
  return value === 'webgl2' || value === 'webgpu' ? value : null
}

/**
 * A GPU surface on a canvas: WebGPU where the browser has it, WebGL2 where it
 * does not, or whichever `backend` names. Resolves to `null` when neither is
 * available — the canvas is left untouched, so a CSS fallback behind it shows.
 *
 * Owns no frame loop. Draw from `useTicker`, like everything else that moves,
 * so the whole site runs on one RAF and Tweak's slow-mo reaches it.
 */
export async function createGpu(canvas: HTMLCanvasElement, options: GpuOptions = {}): Promise<Gpu | null> {
  const alpha = options.alpha ?? true
  const maxDpr = options.dpr ?? 2
  const wanted = override() ?? options.backend ?? 'auto'

  const captures: ((url: string) => void)[] = []
  const surface: Surface = {
    width: canvas.width,
    height: canvas.height,
    dirty: true,
    drawn() {
      if (!captures.length) return
      const url = canvas.toDataURL('image/png')
      for (const resolve of captures.splice(0)) resolve(url)
    },
    resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, maxDpr)
      const w = Math.max(1, Math.round(canvas.clientWidth * dpr))
      const h = Math.max(1, Math.round(canvas.clientHeight * dpr))
      if (canvas.width === w && canvas.height === h && surface.width === w && surface.height === h) return false
      canvas.width = w
      canvas.height = h
      surface.width = w
      surface.height = h
      surface.dirty = true
      return true
    },
  }
  surface.resize()

  let backend: Backend | null = null
  let impl: BackendImpl | null = null
  if (wanted !== 'webgl2' && gpuNavigator()) {
    impl = await createWebGPU(canvas, alpha, surface)
    if (impl) backend = 'webgpu'
  }
  // A canvas that has handed out a WebGPU context can never give a WebGL one,
  // which is why WebGPU is only asked for its context once a device exists.
  if (!impl && wanted !== 'webgpu') {
    impl = createWebGL2(canvas, alpha, surface)
    if (impl) backend = 'webgl2'
  }
  if (!impl || !backend) return null

  const b = impl
  const chosen = backend
  // The size can change between the probe and the first draw — a ResizeObserver
  // marks it, the next draw applies it.
  const observer = new ResizeObserver(() => {
    surface.dirty = true
  })
  observer.observe(canvas)

  const registration: Registration = {
    invalidate: () => {
      surface.dirty = true
    },
    capture: () =>
      new Promise<string>((resolve) => {
        captures.push(resolve)
        surface.dirty = true
      }),
    info: (): SurfaceInfo => ({
      backend: chosen,
      canvas,
      width: surface.width,
      height: surface.height,
      passes: b.describe(),
    }),
  }
  live.add(registration)

  return {
    backend: chosen,
    canvas,
    get width() {
      return surface.width
    },
    get height() {
      return surface.height
    },
    get dirty() {
      return surface.dirty
    },
    pass: (o) => b.pass(o),
    texture: (s, o) => b.texture(s, o),
    target: (o) => b.target(o),
    resize() {
      const changed = surface.resize()
      if (changed) b.resized()
      return changed
    },
    dispose() {
      observer.disconnect()
      live.delete(registration)
      b.dispose()
    },
  }
}
