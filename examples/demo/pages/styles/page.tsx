import { useEffect, useRef, useState } from 'react'

interface TypeSpec {
  family: string
  size: string
  weight: string
  leading: string
  tracking: string
}

const TYPE_ROLES = [
  {
    key: 'display',
    name: 'Title — display',
    use: 'Chapter openers and the index claim. The Title style, scaled fluidly with the viewport rather than set at a size of its own.',
    scale: 'clamp(44px, 9vw, 90px)',
    sample: 'Four Screens',
  },
  {
    key: 'title',
    name: 'Title',
    use: 'Section headings, numerals, pull quotes. The style at its base size.',
    sample: 'The Binary Press',
  },
  {
    key: 'body-large',
    name: 'Body — large',
    use: 'Ledes and opening paragraphs: the step between a title and running prose. Tighter leading, since the lines are longer.',
    sample:
      'The trick is not tonal. It is spatial: break the image into dots of varying size.',
  },
  {
    key: 'body',
    name: 'Body',
    use: 'All running prose. Measure does the work that a second size would.',
    sample:
      'A printing press is a binary device. It carries one film of ink at one density.',
  },
  {
    key: 'small',
    name: 'Small',
    use: 'Captions, figure refs, running heads, metadata, footnotes, nav.',
    sample: 'Abb. 3 · 1904 · The Half-Tone Process, Iliffe & Sons',
  },
] as const

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
        <h1 className="styles__title col-full">Type &amp; Colour</h1>
        <p className="styles__lede col-stack-b">
          Four type styles and two surfaces. Everything on this site is built
          from what is on this page — the values below are read from the live
          stylesheet, so they cannot drift from what you are looking at.
        </p>
      </header>

      {/* ── type ─────────────────────────────────────────────────────── */}
      <section className="grid styles__section">
        <h2 className="col-aside styles__h">Typography</h2>
        <p className="col-text styles__note">
          Franklin Gothic sets the titles and the small copy; Adobe Garamond
          sets every line of prose. Display is the Title style scaled with the
          viewport, not a size of its own — so the system is really two faces,
          four steps.
        </p>
      </section>

      {TYPE_ROLES.map((role) => (
        <section className="grid styles__type" key={role.key}>
          <div className="col-aside styles__typemeta">
            <span className="label">{role.name}</span>
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
              {'scale' in role && (
                <>
                  <dt>Scale</dt>
                  <dd className="styles__clamp">{role.scale}</dd>
                </>
              )}
            </dl>
            {'scale' in role && (
              <p className="styles__caveat">
                Size above is measured at this window width — resize and it
                moves.
              </p>
            )}
          </div>
          <div className="col-right">
            <p className={`styles__sample styles__sample--${role.key}`} data-spec={role.key}>
              {role.sample}
            </p>
          </div>
        </section>
      ))}

      {/* ── colour ───────────────────────────────────────────────────── */}
      <section className="grid styles__section">
        <h2 className="col-aside styles__h">Colour</h2>
        <p className="col-text styles__note">
          Two surfaces: chapters print dark on paper, the index and the darkroom
          invert. The four plate colours appear only where CMYK is the subject —
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
          Colours are CSS custom properties in <code>styles/tokens.scss</code>;
          type styles are mixins in <code>styles/typography.scss</code>. Motion
          numbers live separately, in <code>motion.ts</code> token modules —
          editable live in the dev overlay.
        </p>
      </footer>
    </article>
  )
}
