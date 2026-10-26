import { createElement, type RefObject, useEffect, useRef, useState } from 'react'
import { createGpu } from './gpu'
import { createStage, type PlaneOptions, registerPlane, type Stage, type StageOptions } from './stage'
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

export interface GpuStageProps extends StageOptions {
  /**
   * Stacking order of the stage canvas. It draws OVER the pages — they paint
   * opaque backgrounds — so it must clear the outgoing page, which a
   * transition lifts to z-index 1. Default `2`. Shell UI meant to cover
   * planes (a menu) needs a higher one.
   */
  zIndex?: number
  className?: string
}

/**
 * The canvas planes are drawn on: fixed over the viewport, transparent,
 * click-through. Mount exactly one, in the shell (`app.tsx`), so it survives
 * navigation — a plane can then be drawn mid-transition, across both pages.
 * With no WebGPU or WebGL2 it stays empty and every plane stays a DOM element.
 */
export function GpuStage({ zIndex = 2, className, ...options }: GpuStageProps) {
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const element = canvas.current
    if (!element) return undefined
    let alive = true
    let stage: Stage | null = null
    void createStage(element, options).then((created) => {
      if (!alive) return created?.dispose()
      stage = created
    })
    return () => {
      alive = false
      stage?.dispose()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return createElement('canvas', {
    ref: canvas,
    className,
    'aria-hidden': true,
    'data-gpu-stage': '',
    style: {
      position: 'fixed',
      inset: 0,
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      zIndex,
    },
  })
}

/**
 * Draw this element on the stage instead of in the DOM.
 *
 * The element stays exactly where it is — server-rendered, in the
 * accessibility tree, laid out by CSS, moved by your animations — and the
 * stage draws it, with a shader, wherever it is each frame. Once the GPU has
 * it, the DOM copy is hidden (`filter: opacity(0)`); with no stage, no GPU or
 * an image the GPU cannot read, it simply stays visible. Returns whether the
 * GPU is drawing it now.
 *
 *   const img = useRef<HTMLImageElement>(null)
 *   usePlane(img, { fragment: { wgsl: ripple, glsl: rippleGl }, uniforms: ({ time }) => ({ time }) })
 *   return <img ref={img} src={cover} alt={title} />
 */
export function usePlane(
  element: RefObject<HTMLElement | null>,
  options: PlaneOptions = {},
): boolean {
  const [live, setLive] = useState(false)
  const current = useRef(options)
  current.current = options
  useEffect(() => {
    const el = element.current
    if (!el) return undefined
    return registerPlane({ element: el, options: current, setLive })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return live
}
