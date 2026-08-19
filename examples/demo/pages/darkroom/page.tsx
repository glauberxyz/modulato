import { useCallback, useEffect, useRef, useState } from 'react'
import { setSearchParam, useSearchParams } from 'modulato'
import { HalftoneImage } from '../../lib/HalftoneCanvas'
import { DEFAULTS, type HalftoneUniforms } from '../../lib/halftone'
import { Choice, Slider } from '../../lib/Control'

/**
 * A photograph rather than the live raymarched scene.
 *
 * The scene cost a full render every frame for as long as the page was open —
 * `HalftoneScene` has no dirty check, because a moving scene is never clean —
 * and it was very nearly neutral, so three of the four plates had almost
 * nothing to carry and the darkroom demonstrated a press with one screen in
 * it. This has real hues in three directions, so every control here changes
 * something visible. Screened stills only redraw when a uniform moves, which
 * means the page is idle whenever nobody is dragging.
 */
const SOURCE = '/plates/prager-eve-2008.jpg'

const PRESETS: Record<string, Partial<HalftoneUniforms>> = {
  newsprint: { size: 0.66, contrast: 1.5, softness: 0.05, type: 0, gridNoise: 0.18, grainOverlay: 0.3 },
  magazine: { size: 0.3, contrast: 1.2, softness: 0.1, type: 0, gridNoise: 0, grainOverlay: 0.08 },
  riso: { size: 0.55, contrast: 1.8, softness: 0.35, type: 1, gridNoise: 0.3, grainOverlay: 0.22 },
  blown: { size: 0.85, contrast: 2.4, softness: 0.8, type: 1, gridNoise: 0.5, grainOverlay: 0.4 },
}

export default function Darkroom() {
  // The preset lives in the URL — shareable shader state, written shallowly so
  // nothing remounts and the canvas keeps its WebGL context.
  const { preset } = useSearchParams()
  // The site's real inks on its real paper. The dark inverted palette this
  // used to run belonged to the raymarched scene, which needed to sit inside a
  // dark page; a photograph screened through actual cyan, magenta, yellow and
  // black is the thing the whole site is about, and it cannot show that in
  // negative.
  // Seeded with the default, NOT with the URL. The query is empty on the server
  // and through the hydrating render, so reading it here would capture that
  // emptiness once and keep it — which is what made /darkroom?preset=riso show
  // the Riso button pressed over Magazine's plates. The effect below is what
  // actually applies it.
  const [u, setU] = useState<HalftoneUniforms>(() => ({
    ...DEFAULTS,
    ...PRESETS.magazine,
    cover: true,
  }))

  const uniforms = useRef<HalftoneUniforms>(u)

  const patch = useCallback((next: Partial<HalftoneUniforms>) => {
    const merged = { ...uniforms.current, ...next }
    uniforms.current = merged
    setU(merged)
  }, [])

  // The URL is the single source of truth for the preset, and it arrives one
  // render after hydration. Applying it here rather than at the click means
  // Back and Forward move the plates and not just the radio — the button
  // reads the same query this does.
  const applied = useRef<string | undefined>(undefined)
  useEffect(() => {
    if (preset === applied.current) return
    applied.current = preset
    const next = preset ? PRESETS[preset] : undefined
    if (next) patch(next)
  }, [preset, patch])

  const applyPreset = (key: string) => setSearchParam('preset', key)

  return (
    <main className="dark-room is-dark" data-page="darkroom">
      <div className="dark-room__panel" data-lenis-prevent="">
        <Choice
          label="Preset"
          value={preset ?? 'magazine'}
          options={[
            { value: 'newsprint', label: 'Newsprint' },
            { value: 'magazine', label: 'Magazine' },
            { value: 'riso', label: 'Riso' },
            { value: 'blown', label: 'Blown out' },
          ]}
          onChange={applyPreset}
        />

        <Slider
          label="Ruling"
          value={u.size}
          min={0.05}
          max={0.95}
          onChange={(v) => patch({ size: v })}
          format={(v) => `${Math.round(400 - v ** 0.7 * 393)} cells`}
        />
        <Slider label="Contrast" value={u.contrast} min={0.5} max={3} onChange={(v) => patch({ contrast: v })} />
        <Slider label="Softness" value={u.softness} min={0} max={1} onChange={(v) => patch({ softness: v })} />
        <Slider label="Grid noise" value={u.gridNoise} min={0} max={1} onChange={(v) => patch({ gridNoise: v })} />
        <Slider label="Grain" value={u.grainOverlay} min={0} max={0.6} onChange={(v) => patch({ grainOverlay: v })} />

        <Choice
          label="Dot"
          value={u.type}
          options={[
            { value: 0, label: 'Dots' },
            { value: 1, label: 'Ink' },
            { value: 2, label: 'Sharp' },
          ]}
          onChange={(v) => patch({ type: v })}
        />

        <div className="dark-room__angles">
          <span className="label">Screen angles</span>
          {['C', 'M', 'Y', 'K'].map((n, i) => (
            <Slider
              key={n}
              label={n}
              value={u.angles[i]}
              min={0}
              max={90}
              step={1}
              format={(v) => `${v.toFixed(0)}°`}
              onChange={(v) => {
                const next = [...uniforms.current.angles] as HalftoneUniforms['angles']
                next[i] = v
                patch({ angles: next })
              }}
            />
          ))}
        </div>

        <p className="dark-room__foot">
          Photograph: “Eve” (2008) by Alex Prager. Halftone shader: Paper
          Design’s HalftoneCmyk, Apache-2.0, extended here.
        </p>
      </div>

      <div className="dark-room__stage">
        <HalftoneImage
          src={SOURCE}
          alt="A figure on an open road with pigeons scattering around them, screened at the current settings"
          uniforms={uniforms}
          className="dark-room__scene"
        />
      </div>
    </main>
  )
}
