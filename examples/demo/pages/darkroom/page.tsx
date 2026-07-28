import { useRef, useState } from 'react'
import { resolveTokens, useSearchParam } from 'modulato'
import { HalftoneScene } from '../../lib/HalftoneCanvas'
import { DEFAULTS, type HalftoneUniforms, type SceneUniforms } from '../../lib/halftone'
import { Choice, Slider } from '../../lib/Control'
import tokens from './motion'

const PRESETS: Record<string, Partial<HalftoneUniforms>> = {
  newsprint: { size: 0.66, contrast: 1.5, softness: 0.05, type: 0, gridNoise: 0.18, grainOverlay: 0.3 },
  magazine: { size: 0.3, contrast: 1.2, softness: 0.1, type: 0, gridNoise: 0, grainOverlay: 0.08 },
  riso: { size: 0.55, contrast: 1.8, softness: 0.35, type: 1, gridNoise: 0.3, grainOverlay: 0.22 },
  blown: { size: 0.85, contrast: 2.4, softness: 0.8, type: 1, gridNoise: 0.5, grainOverlay: 0.4 },
}

export default function Darkroom() {
  const t = resolveTokens(tokens)
  // The preset lives in the URL — shareable shader state, no remount.
  const [preset, setPreset] = useSearchParam('preset')
  const [u, setU] = useState<HalftoneUniforms>(() => ({
    ...DEFAULTS,
    ...(PRESETS[preset ?? 'magazine'] ?? {}),
    paper: '#14110f',
    inks: ['#2d4a52', '#4a2d3d', '#4a4530', '#f4f1ea'],
  }))

  const uniforms = useRef<HalftoneUniforms>(u)
  const scene = useRef<SceneUniforms>({ ...t.scene })

  const patch = (next: Partial<HalftoneUniforms>) => {
    const merged = { ...uniforms.current, ...next }
    uniforms.current = merged
    setU(merged)
  }

  const applyPreset = (key: string) => {
    setPreset(key)
    patch(PRESETS[key] ?? {})
  }

  return (
    <main className="dark-room is-dark" data-page="darkroom">
      <div className="dark-room__panel" data-lenis-prevent="">
        <header className="dark-room__head">
          <span className="label">Darkroom</span>
          <a className="dark-room__back" href="/">
            ← Index
          </a>
        </header>

        <p className="dark-room__intro">
          The press, with every stop open. This is the same shader running behind
          the index — and behind modulato.org.
        </p>

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
          Every value here is a motion token in <code>motion.ts</code> — the same
          numbers the dev overlay edits and an agent can set over MCP. The preset
          is in the URL, so this exact screen is a link.
        </p>
      </div>

      <div className="dark-room__stage">
        <HalftoneScene uniforms={uniforms} scene={scene} className="dark-room__scene" />
      </div>
    </main>
  )
}
