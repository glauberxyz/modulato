import { useRef, useState } from 'react'
import { HalftoneImage } from '../HalftoneCanvas'
import { DEFAULTS, type HalftoneUniforms } from '../halftone'
import { Choice, Diagram, Slider } from '../Control'

/** RGB → CMYK, the same arithmetic the shader does per pixel. */
function separate(r: number, g: number, b: number) {
  const max = Math.max(r, g, b)
  const k = 1 - max
  if (max < 1e-5) return { c: 0, m: 0, y: 0, k: 1 }
  return { c: (max - r) / max, m: (max - g) / max, y: (max - b) / max, k }
}

const SWATCHES: Array<{ label: string; rgb: [number, number, number] }> = [
  { label: 'Neutral grey', rgb: [0.5, 0.5, 0.5] },
  { label: 'Warm shadow', rgb: [0.17, 0.13, 0.1] },
  { label: 'Sky', rgb: [0.35, 0.62, 0.85] },
  { label: 'Skin', rgb: [0.85, 0.68, 0.56] },
]

/**
 * Why there is a black plate. Drag toward neutral and watch C, M and Y all
 * fall to zero — the diagram that explains a real decision in this site's
 * own scene shader.
 */
export function SeparationDiagram() {
  const [rgb, setRgb] = useState<[number, number, number]>([0.17, 0.13, 0.1])
  const [plates, setPlates] = useState<'all' | 'cmy'>('all')
  const uniforms = useRef<HalftoneUniforms>({
    ...DEFAULTS,
    size: 0.5,
    plates: [1, 1, 1, 1],
  })

  const { c, m, y, k } = separate(...rgb)
  const setChannel = (i: number, v: number) => {
    const next = [...rgb] as [number, number, number]
    next[i] = v
    setRgb(next)
  }
  const setMode = (mode: 'all' | 'cmy') => {
    setPlates(mode)
    uniforms.current.plates = mode === 'all' ? [1, 1, 1, 1] : [1, 1, 1, 0]
  }

  const hex = `#${rgb.map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('')}`
  const neutral = Math.max(...rgb) - Math.min(...rgb) < 0.02

  return (
    <Diagram
      n="Fig. B"
      title="Grey collapses to black"
      controls={
        <>
          <Choice
            label="Swatch"
            value={
              SWATCHES.find((s) => s.rgb.join() === rgb.join())?.label ?? 'custom'
            }
            options={SWATCHES.map((s) => ({ value: s.label, label: s.label }))}
            onChange={(label) => {
              const s = SWATCHES.find((x) => x.label === label)
              if (s) setRgb(s.rgb)
            }}
          />
          {['Red', 'Green', 'Blue'].map((n, i) => (
            <Slider
              key={n}
              label={n}
              value={rgb[i]}
              min={0}
              max={1}
              onChange={(v) => setChannel(i, v)}
            />
          ))}
          <Choice
            label="Plates"
            value={plates}
            options={[
              { value: 'all', label: 'CMYK' },
              { value: 'cmy', label: 'No black' },
            ]}
            onChange={setMode}
          />
          <div className="sep__bars">
            {(
              [
                ['C', c, 'var(--plate-c)'],
                ['M', m, 'var(--plate-m)'],
                ['Y', y, 'var(--plate-y)'],
                ['K', k, 'var(--ink)'],
              ] as const
            ).map(([name, v, colour]) => (
              <div className="sep__bar" key={name}>
                <span className="sep__name">{name}</span>
                <span className="sep__track">
                  <span
                    className="sep__fill"
                    style={{ width: `${v * 100}%`, background: colour }}
                  />
                </span>
                <span className="sep__num">{(v * 100).toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </>
      }
      caption={
        neutral
          ? 'Neutral: cyan, magenta and yellow are all exactly zero. Black is carrying the entire image on one screen.'
          : 'Off the neutral axis all four plates have something to carry — which is why this site tints its shadows warm rather than grey.'
      }
    >
      <div className="sep__stage" style={{ background: hex }}>
        <HalftoneImage
          src="/plates/ives-portrait.jpg"
          alt="A portrait separated into plates"
          uniforms={uniforms}
        />
      </div>
    </Diagram>
  )
}
