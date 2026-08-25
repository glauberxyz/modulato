import { useEffect, useRef, useState } from 'react'
import type { TypeStyle } from 'modulato'
import spec from '../../type'

interface TypeSpec {
  family: string
  size: string
  weight: string
  leading: string
  tracking: string
}

/**
 * The prose beside each specimen, keyed by the style's name in `type.ts`.
 *
 * The page iterates the type system, not this map: add a style to type.ts and
 * it appears below, with a generic sample until somebody writes it one. What
 * a style IS belongs in type.ts; what it is FOR belongs here, and neither is a
 * copy of the other.
 */
const NOTES: Record<string, { use: string; sample: string }> = {
  title: {
    use: 'Section headings, numerals, pull quotes. The style at its base size.',
    sample: 'The Binary Press',
  },
  display: {
    use: 'Chapter openers and the index claim. The Title style, scaled fluidly with the viewport rather than set at a size of its own.',
    sample: 'Four Screens',
  },
  subhead: {
    use: 'Headings inside a chapter, and the section heads on this page. A Title at reading scale.',
    sample: 'A screen is a grid of dots',
  },
  'plate-title': {
    use: 'A plate’s title in the press diagrams. Its own step, because these are often whole sentences and want to break later than a subhead.',
    sample: 'One hundred and seventy-five, two hundred, four hundred lines',
  },
  statement: {
    use: 'The statement heading, filling the fold. The size below is a fallback — Statement.tsx measures the real one against the rendered line boxes.',
    sample: 'Ink is binary',
  },
  'body-large': {
    use: 'Ledes and opening paragraphs: the step between a title and running prose. Tighter leading, since the lines are longer.',
    sample:
      'The trick is not tonal. It is spatial: break the image into dots of varying size.',
  },
  body: {
    use: 'All running prose. Measure does the work that a second size would.',
    sample:
      'A printing press is a binary device. It carries one film of ink at one density.',
  },
  small: {
    use: 'Captions, figure refs, running heads, metadata, footnotes, nav.',
    sample: 'Fig. 3 · 1904 · The Half-Tone Process, Iliffe & Sons',
  },
  label: {
    use: 'Small uppercase copy — labels and running heads only. Set solid: the caps carry the distinction on their own.',
    sample: 'Plate iii — magenta',
  },
  readout: {
    use: 'Diagram readouts and the clamp expressions on this page. The smallest thing on the site.',
    sample: 'screen 175 lpi · angle 75° · dot 0.14mm',
  },
}

/** Every style in the type system, in the order type.ts declares them. */
const TYPE_ROLES = Object.entries(spec.styles).map(([key, style]) => ({
  key,
  style: style as TypeStyle,
  use: NOTES[key]?.use ?? 'No note yet — add one in pages/styles/page.tsx.',
  sample: NOTES[key]?.sample ?? 'The quick brown fox jumps over the lazy dog. 0123456789',
  // A fluid step is measured at whatever width the window happens to be, so
  // the specimen has to say so — the number beside it is true for one width.
  scale: fluidStep(style.size),
}))

/**
 * The authored size, when it is a fluid step; null when it is a fixed one.
 *
 * A fluid step reads back as the two ends and the viewport range they cross —
 * what `type.ts` actually says — rather than as the `clamp()` Modulato solves
 * from them. The clamp is the output; a specimen sheet should print the
 * decision, which is the four numbers.
 */
function fluidStep(size: unknown): string | null {
  const value =
    typeof size === 'string' && size in (spec.scale ?? {})
      ? (spec.scale as Record<string, unknown>)[size]
      : size
  if (value && typeof value === 'object' && 'min' in value && 'max' in value) {
    const pair = value as { min: number; max: number; from?: number; to?: number }
    return `${pair.min} → ${pair.max}px across ${pair.from ?? spec.fluid.from}–${pair.to ?? spec.fluid.to}px`
  }
  // A hand-written one-off is still legal, and still worth printing.
  return typeof value === 'string' && /clamp\(|vw|vh|%/.test(value) ? value : null
}

const SURFACE = [
  { var: '--paper', name: 'Paper', note: 'Page surface' },
  { var: '--ink', name: 'Ink', note: 'Body text' },
  { var: '--muted', name: 'Muted', note: 'Captions, metadata' },
  { var: '--rule', name: 'Rule', note: 'Hairlines, borders' },
]

const PLATES = [
  { var: '--plate-c', name: 'Cyan', angle: '15°' },
  { var: '--plate-m', name: 'Magenta', angle: '75°' },
  { var: '--plate-y', name: 'Yellow', angle: '0°' },
  { var: '--plate-k', name: 'Black', angle: '45°' },
]

/** Computed values read from the DOM — the specimen documents what is
 *  actually rendering, not a second copy of the numbers. */
function useComputedSpecs() {
  const scope = useRef<HTMLDivElement>(null)
  const darkProbe = useRef<HTMLDivElement>(null)
  const [type, setType] = useState<Record<string, TypeSpec>>({})
  const [light, setLight] = useState<Record<string, string>>({})
  const [dark, setDark] = useState<Record<string, string>>({})

  useEffect(() => {
    const el = scope.current
    if (!el) return
    const specs: Record<string, TypeSpec> = {}
    for (const role of TYPE_ROLES) {
      const node = el.querySelector<HTMLElement>(`[data-spec="${role.key}"]`)
      if (!node) continue
      const c = getComputedStyle(node)
      specs[role.key] = {
        family: c.fontFamily.split(',')[0].replace(/["']/g, ''),
        size: c.fontSize,
        weight: c.fontWeight,
        leading: (parseFloat(c.lineHeight) / parseFloat(c.fontSize)).toFixed(2),
        tracking: c.letterSpacing === 'normal' ? '0' : c.letterSpacing,
      }
    }
    setType(specs)

    const read = (from: Element) => {
      const c = getComputedStyle(from)
      const out: Record<string, string> = {}
      for (const t of [...SURFACE, ...PLATES]) out[t.var] = c.getPropertyValue(t.var).trim()
      return out
    }
    setLight(read(document.documentElement))
    if (darkProbe.current) setDark(read(darkProbe.current))
  }, [])

  return { scope, darkProbe, type, light, dark }
}

export default function Styles() {
  const { scope, darkProbe, type, light, dark } = useComputedSpecs()

  return (
    <article className="styles" data-page="styles" ref={scope}>
      {/* Off-screen probe: the dark surface values live under .is-dark, so
          they have to be read from an element that actually has the class. */}
      <div className="is-dark styles__probe" ref={darkProbe} aria-hidden="true" />

      <header className="styles__head grid">
        <div className="styles__meta col-full">
          <span className="label">Specimen</span>
          <span className="label">Halftone</span>
        </div>
        <h1 className="styles__title col-full">Type &amp; Color</h1>
        <p className="styles__lede col-stack-b">
          One type system and two surfaces. Everything on this site is built
          from what is on this page — the styles come from <code>type.ts</code>{' '}
          and the measurements from the live stylesheet, so neither can drift
          from what you are looking at.
        </p>
      </header>

      {/* ── type ─────────────────────────────────────────────────────── */}
      <section className="grid styles__section">
        <h2 className="col-aside styles__h">Typography</h2>
        <p className="col-text styles__note">
          Franklin Gothic sets the titles and the small copy; Adobe Garamond
          sets every line of prose. Every style below is read from{' '}
          <code>type.ts</code>, and every measurement from the element beside
          it — so this page cannot drift from the site. In dev, press the round
          <b>Aa</b> button by the Tweak launcher and click any of them to edit
          it where it sits.
        </p>
      </section>

      {TYPE_ROLES.map((role) => (
        <section className="grid styles__type" key={role.key}>
          <div className="col-aside styles__typemeta">
            <span className="label">{role.key}</span>
            <p className="styles__use">{role.use}</p>
            <dl className="styles__spec">
              <dt>Family</dt>
              <dd>{type[role.key]?.family ?? '—'}</dd>
              <dt>Size</dt>
              <dd>{type[role.key]?.size ?? '—'}</dd>
              <dt>Weight</dt>
              <dd>{type[role.key]?.weight ?? '—'}</dd>
              <dt>Leading</dt>
              <dd>{type[role.key]?.leading ?? '—'}</dd>
              <dt>Tracking</dt>
              <dd>{type[role.key]?.tracking ?? '—'}</dd>
              {role.scale && (
                <>
                  <dt>Scale</dt>
                  <dd className="styles__clamp">{role.scale}</dd>
                </>
              )}
            </dl>
            {role.scale && (
              <p className="styles__caveat">
                Size above is measured at this window width — resize and it
                moves.
              </p>
            )}
          </div>
          <div className="col-right">
            {/* The class Modulato generates for the style — the specimen is
                the real thing, not a copy of it. */}
            <p className={`type-${role.key} styles__sample`} data-spec={role.key}>
              {role.sample}
            </p>
          </div>
        </section>
      ))}

      {/* ── color ───────────────────────────────────────────────────── */}
      <section className="grid styles__section">
        <h2 className="col-aside styles__h">Color</h2>
        <p className="col-text styles__note">
          Two surfaces: chapters print dark on paper, the index and the darkroom
          invert. The four plate colors appear only where CMYK is the subject —
          they are an argument, not decoration.
        </p>
      </section>

      <section className="grid styles__section">
        <div className="col-left">
          <span className="label styles__sublabel">Paper surface</span>
          <ul className="styles__swatches">
            {SURFACE.map((t) => (
              <li className="styles__swatch" key={t.var}>
                <span className="styles__chip" style={{ background: `var(${t.var})` }} />
                <span className="styles__swatchname">{t.name}</span>
                <span className="styles__hex">{light[t.var] || '—'}</span>
                <span className="styles__swatchnote">{t.note}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="col-right">
          <span className="label styles__sublabel">Inverted surface</span>
          <ul className="styles__swatches is-dark styles__swatches--dark">
            {SURFACE.map((t) => (
              <li className="styles__swatch" key={t.var}>
                <span className="styles__chip" style={{ background: `var(${t.var})` }} />
                <span className="styles__swatchname">{t.name}</span>
                <span className="styles__hex">{dark[t.var] || '—'}</span>
                <span className="styles__swatchnote">{t.note}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="grid styles__section">
        <div className="col-full">
          <span className="label styles__sublabel">The four plates</span>
          <ul className="styles__plates">
            {PLATES.map((p) => (
              <li key={p.var}>
                <span className="styles__platechip" style={{ background: `var(${p.var})` }} />
                <span className="styles__swatchname">{p.name}</span>
                <span className="styles__hex">{light[p.var] || '—'}</span>
                <span className="styles__swatchnote">Screen angle {p.angle}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── grid ─────────────────────────────────────────────────────── */}
      <section className="grid styles__section">
        <h2 className="col-aside styles__h">Grid</h2>
        <p className="col-text styles__note">
          Twelve columns, a 20px gutter, 32px margins — six columns on a phone.
          The rhythm of every page comes from which columns a block occupies.
        </p>
      </section>

      <section className="grid styles__gridshow">
        {Array.from({ length: 12 }, (_, i) => (
          <span className="styles__col" key={i}>
            {i + 1}
          </span>
        ))}
      </section>

      <footer className="styles__foot grid">
        <p className="col-text styles__note">
          Colors are CSS custom properties in <code>styles/tokens.scss</code>;
          type styles are mixins in <code>styles/typography.scss</code>. Motion
          numbers live separately, in <code>motion.ts</code> token modules —
          editable live in the dev overlay.
        </p>
      </footer>
    </article>
  )
}
