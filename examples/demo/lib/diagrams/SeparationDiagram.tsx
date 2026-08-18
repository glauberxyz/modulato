import { useRef, useState } from 'react'
import { HalftoneFlat } from '../HalftoneCanvas'
import { DEFAULTS, type HalftoneUniforms } from '../halftone'
import { Choice, Diagram, Slider } from '../Control'
import './diagrams.scss'

/** RGB → CMYK, the same arithmetic the shader does per pixel. */
function separate(r: number, g: number, b: number) {
  const max = Math.max(r, g, b)
  const k = 1 - max
  if (max < 1e-5) return { c: 0, m: 0, y: 0, k: 1 }
  return { c: (max - r) / max, m: (max - g) / max, y: (max - b) / max, k }
}

type Densities = { c: number; m: number; y: number; k: number }

const toHex = (rgb: number[]) =>
  `#${rgb.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0')).join('')}`

/** Total ink laid down, as printers count it — the sum of all four plates. */
const coverage = (d: Densities) => Math.round((d.c + d.m + d.y + d.k) * 100)

/**
 * A screen coarse enough to read as dots at half a stage wide. Both fields
 * take the same one — the comparison is about ink, and a different ruling on
 * either side would be a second variable nobody asked for.
 *
 * `contrast: 1` is the one that matters. The shader runs the color through
 * `applyContrast` BEFORE separating it, so any other value silently shifts
 * the densities away from the percentages in the bars beside it — the
 * diagram would be quoting numbers the picture no longer obeys.
 */
const FIELD: HalftoneUniforms = {
  ...DEFAULTS,
  size: 0.88,
  contrast: 1,
  grainOverlay: 0,
  gridNoise: 0,
  gains: [0, 0, 0, 0],
}

const SWATCHES: Array<{ label: string; rgb: [number, number, number] }> = [
  { label: 'Neutral gray', rgb: [0.5, 0.5, 0.5] },
  { label: 'Warm shadow', rgb: [0.17, 0.13, 0.1] },
  { label: 'Sky', rgb: [0.35, 0.62, 0.85] },
  { label: 'Skin', rgb: [0.85, 0.68, 0.56] },
]

/**
 * Why there is a black plate — the same color printed twice, once with all
 * four inks and once with three.
 *
 * Both states are on screen at once rather than behind a toggle, because the
 * argument IS the difference between them: asked for a neutral gray, the four
 * plates give you gray at fifty per cent ink and the three give you brown at
 * a hundred and fifty. A toggle makes the reader hold one of those in memory
 * while looking at the other, which is the comparison's own work.
 *
 * Both fields are SCREENED, by the site's own shader, because this site opens
 * by telling you a printed gray is not gray. A flat patch of color labeled
 * "what CMYK prints" would contradict the one claim everything else rests on
 * — and in this chapter of all of them, since four screens sharing a sheet is
 * the subject. The right-hand field shows three of them beating together,
 * which is the next movement arriving early.
 */
export function SeparationDiagram() {
  const [rgb, setRgb] = useState<[number, number, number]>([0.5, 0.5, 0.5])

  const cmyk = separate(...rgb)
  // No black plate, so each colored ink has to carry its whole channel —
  // the naive separation, and the one every account of CMYK starts from.
  const cmy: Densities = { c: 1 - rgb[0], m: 1 - rgb[1], y: 1 - rgb[2], k: 0 }

  // The shader does its own separation from the color it is handed, so both
  // presses get the SAME field and differ only in `noBlack`. The densities
  // above are the same arithmetic in JS, for the bars and the ink totals —
  // one rule, quoted twice, rather than two rules that can disagree.
  const withK = useRef<HalftoneUniforms>({ ...FIELD, flat: '#808080' })
  const withoutK = useRef<HalftoneUniforms>({ ...FIELD, flat: '#808080', noBlack: true })
  const field = toHex(rgb)
  withK.current.flat = field
  withoutK.current.flat = field

  const setChannel = (i: number, v: number) => {
    const next = [...rgb] as [number, number, number]
    next[i] = v
    setRgb(next)
  }

  const neutral = Math.max(...rgb) - Math.min(...rgb) < 0.02

  return (
    <Diagram
      n="Fig. B"
      title="Gray collapses to black"
      controls={
        <>
          <Choice
            label="Swatch"
            value={SWATCHES.find((s) => s.rgb.join() === rgb.join())?.label ?? 'custom'}
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
          {/* The four plate densities behind the left-hand field. K is the
              one to watch: it is `1 − max(r, g, b)` and nothing else. */}
          <div className="sep__bars">
            {(
              [
                ['C', cmyk.c, 'var(--plate-c)'],
                ['M', cmyk.m, 'var(--plate-m)'],
                ['Y', cmyk.y, 'var(--plate-y)'],
                ['K', cmyk.k, 'var(--ink)'],
              ] as const
            ).map(([name, v, color]) => (
              <div className="sep__bar" key={name}>
                <span className="sep__name">{name}</span>
                <span className="sep__track">
                  <span className="sep__fill" style={{ width: `${v * 100}%`, background: color }} />
                </span>
                <span className="sep__num">{(v * 100).toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </>
      }
      caption={
        neutral
          ? 'Neutral: cyan, magenta and yellow are all exactly zero and black carries it alone. The field on the right is that same gray asked of three colored inks — three times the ink, and still not gray.'
          : 'Off the neutral axis all four plates have something to carry — which is why this site tints its shadows warm rather than neutral, so the three color screens have something to say.'
      }
    >
      <div className="sep__compare">
        <figure className="sep__half">
          <HalftoneFlat
            className="sep__field"
            label="The color printed with all four plates"
            uniforms={withK}
          />
          <figcaption className="sep__halfcap figref">
            Fig. B1 · CMYK · {coverage(cmyk)}% ink
          </figcaption>
        </figure>
        <figure className="sep__half">
          <HalftoneFlat
            className="sep__field"
            label="The same color printed with cyan, magenta and yellow only"
            uniforms={withoutK}
          />
          <figcaption className="sep__halfcap figref">
            Fig. B2 · CMY only · {coverage(cmy)}% ink
          </figcaption>
        </figure>
      </div>
    </Diagram>
  )
}
