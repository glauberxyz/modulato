import { type RefObject, useEffect, useRef } from 'react'
import { createGpu } from './gpu'
import type { Gpu, GpuOptions } from './types'

/**
 * A GPU surface on a canvas ref, for exactly as long as the component is
 * mounted. `setup` runs once the surface exists and returns whatever the
 * frame loop needs — usually a pass; the hook hands it back as a ref, `null`
 * until ready.
 *
 *   const canvas = useRef<HTMLCanvasElement>(null)
 *   const press = useGpu(canvas, async (gpu) => {
 *     const pass = await gpu.pass({ fragment: { wgsl: halftone, glsl: halftoneGl } })
 *     return pass.texture('image', gpu.texture(image))
 *   })
 *   useTicker(() => press.current?.set(resolveTokens(tokens).print).draw())
 *
 * Everything created through the surface is disposed on unmount. `deps`
 * re-run setup on a fresh surface, as an effect's would — a shader edit does
 * NOT need to be one of them: imported shaders hot-swap inside the pass.
 *
 * When neither WebGPU nor WebGL2 exists, setup never runs and the ref stays
 * `null` — the frame loop's `?.` is the whole fallback.
 */
export function useGpu<T>(
  canvas: RefObject<HTMLCanvasElement | null>,
  setup: (gpu: Gpu) => T | Promise<T>,
  deps: readonly unknown[] = [],
  options?: GpuOptions,
): RefObject<T | null> {
  const result = useRef<T | null>(null)
  const latest = useRef(setup)
  latest.current = setup

  useEffect(() => {
    const element = canvas.current
    if (!element) return undefined
    let alive = true
    let gpu: Gpu | null = null
    void createGpu(element, options).then(async (created) => {
      if (!created) return
      if (!alive) return created.dispose()
      gpu = created
      const value = await latest.current(created)
      // Unmounted while an async setup ran: what it built goes with the surface.
      if (!alive) return created.dispose()
      result.current = value
    })
    return () => {
      alive = false
      result.current = null
      gpu?.dispose()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return result
}
