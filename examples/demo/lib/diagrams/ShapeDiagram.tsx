import { useRef, useState } from 'react'
import { useTicker } from 'modulato'
import { loadImage, useGpu } from '@modulato/gpu'
import { DEFAULTS } from '../halftone'
import { Choice, Diagram, Slider } from '../Control'
// Both worked out when the site is built, from the same file — the browser
// receives the answers, not the outline and the geometry to derive them.
import field from './smile-stencil.svg?size=320&spread=32&sdf'
import outline from './smile-stencil.svg?pitch=6&points'
import shapeWgsl from './shape.wgsl'
import shapeGlsl from './shape.frag'

/**
 * Two 16-bit coordinates to a texel, so the shader can read the points as a
 * texture: one row, `count` texels wide, x in red/green, y in blue/alpha.
 */
function packPoints(points: Float32Array, count: number): Uint8Array {
  const out = new Uint8Array(count * 4)
  for (let i = 0; i < count; i++) {
    const x = Math.round((points[i * 2] / 200) * 65535)
    const y = Math.round((points[i * 2 + 1] / 200) * 65535)
    out.set([x >> 8, x & 255, y >> 8, y & 255], i * 4)
  }
  return out
}

/**
 * A halftone dot is a distance test against one point. The same test against
 * a precomputed field prints any shape — and the same outline, sampled into
 * points, prints as a screen that follows it.
 */
export function ShapeDiagram() {
  const [mode, setMode] = useState(0)
  const [threshold, setThreshold] = useState(0.5)
  const [dotSize, setDotSize] = useState(2.4)
  const state = useRef({ mode, threshold, dotSize })
  state.current = { mode, threshold, dotSize }

  const canvas = useRef<HTMLCanvasElement>(null)
  const press = useGpu(canvas, async (gpu) => {
    const pass = await gpu.pass({ fragment: { wgsl: shapeWgsl, glsl: shapeGlsl } })
    pass.texture('field', gpu.texture(await loadImage(field.url)))
    pass.texture(
      'points',
      gpu.texture(
        { width: outline.count, height: 1, data: packPoints(outline.points, outline.count) },
        { filter: 'nearest' },
      ),
    )
    return { gpu, pass }
  })

  // Still picture: draw when a control moved or the surface says so.
  const lastKey = useRef('')
  useTicker(() => {
    const p = press.current
    if (!p) return
    const s = state.current
    const key = `${s.mode}|${s.threshold}|${s.dotSize}`
    if (key === lastKey.current && !p.gpu.dirty) return
    lastKey.current = key
    p.pass
      .set({
        resolution: [p.gpu.width, p.gpu.height],
        mode: s.mode,
        threshold: s.threshold,
        dotSize: s.dotSize,
        count: outline.count,
        spread: field.spread,
        fieldSize: field.width,
        paper: DEFAULTS.paper,
        ink: DEFAULTS.inks[3],
      })
      .draw()
  })

  return (
    <Diagram
      n="Fig. F"
      title="Any shape, by distance"
      controls={
        <>
          <Choice
            label="Print"
            value={mode}
            options={[
              { value: 0, label: 'Field' },
              { value: 1, label: 'Dots' },
            ]}
            onChange={setMode}
          />
          {mode === 0 ? (
            <Slider label="Threshold" value={threshold} min={0.15} max={0.85} onChange={setThreshold} />
          ) : (
            <Slider
              label="Dot size"
              value={dotSize}
              min={0.6}
              max={6}
              onChange={setDotSize}
              format={(v) => v.toFixed(1)}
            />
          )}
        </>
      }
      caption={
        mode === 0
          ? 'Every pixel of the stored field says how far it is from the stencil’s edge. Keep what passes the threshold and the shape prints; move the threshold and it swells or thins, the way coverage swells a dot.'
          : 'The same outline, sampled into evenly spaced points when the site was built and printed as dots: a screen that follows the shape instead of a grid.'
      }
    >
      <canvas ref={canvas} role="img" aria-label="The homepage smile as a stencil, printed by a distance test" />
    </Diagram>
  )
}
