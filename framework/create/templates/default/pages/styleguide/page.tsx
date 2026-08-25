import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { TypeStyle } from 'modulato'
import spec from '../../type'
import palette from '../../color'

/**
 * The styleguide: what this site is built out of.
 *
 * DELETE THIS PAGE if you don't want it — it is a page folder like any other,
 * and nothing else in the project imports it. It ships scaffolded because a
 * design system that has no page is a design system nobody looks at, and
 * because it is the fastest way to see whether a type scale actually works
 * before there is a site to put it in.
 *
 * Everything below is READ, never restated. The type styles come from
 * `type.ts` (the same data that generated the stylesheet), and the numbers
 * beside each specimen are read back off the rendered element with
 * `getComputedStyle` — so the page cannot drift from what you are looking at,
 * and a wrong number here is a real bug rather than a stale copy.
 *
 * Colors come from `color.ts` the same way, so adding one there — or with the
 * + button in the overlay's Colors tab — makes it appear here.
 */

/** Fields worth showing per style, in the order a typographer reads them. */
const FIELDS: Array<[keyof TypeStyle & string, string]> = [
  ['font', 'font'],
  ['size', 'size'],
  ['leading', 'leading'],
  ['tracking', 'tracking'],
  ['weight', 'weight'],
]

const SAMPLE: Record<string, string> = {
  headline: 'Typography is what language looks like',
  body: 'A type scale is a closed set of sizes. Everything on the site is set in one of them, which is what makes a page look composed rather than assembled.',
  small: 'Captions, metadata, running heads and nav.',
}

interface Measured {
  size: string
  leading: string
  tracking: string
  weight: string
  family: string
}

/** What the browser actually computed — the specimen documents itself. */
function useMeasured(deps: unknown[]): [
  React.RefObject<HTMLDivElement | null>,
  Record<string, Measured>,
] {
  const scope = useRef<HTMLDivElement>(null)
  const [measured, setMeasured] = useState<Record<string, Measured>>({})
  useEffect(() => {
    const root = scope.current
    if (!root) return
    const out: Record<string, Measured> = {}
    for (const node of root.querySelectorAll<HTMLElement>('[data-specimen]')) {
      const name = node.dataset.specimen
      if (!name) continue
      const c = getComputedStyle(node)
      const px = Number.parseFloat(c.fontSize)
      const lh = Number.parseFloat(c.lineHeight)
      out[name] = {
        size: c.fontSize,
        // Unitless, because that is how it is authored — a ratio survives a
        // size change and a px line-height does not.
        leading: Number.isFinite(lh) && px ? (lh / px).toFixed(2) : c.lineHeight,
        tracking: c.letterSpacing === 'normal' ? '0' : c.letterSpacing,
        weight: c.fontWeight,
        family: c.fontFamily.split(',')[0].replace(/["']/g, ''),
      }
    }
    setMeasured(out)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return [scope, measured]
}

export default function Styleguide() {
  const styleNames = Object.keys(spec.styles)
  const [scope, measured] = useMeasured([styleNames.join()])
  const colors = Object.entries(palette)
  const scale = Object.entries(spec.scale ?? {})

  return (
    <main className="guide" ref={scope}>
      <header className="guide__head">
        <h1 className="guide__title">Styleguide</h1>
        <p className="guide__lede">
          Everything this site is built from. The type styles are read from{' '}
          <code>type.ts</code> and the measurements from the rendered elements,
          so this page cannot disagree with the site. Delete{' '}
          <code>pages/styleguide/</code> when you no longer want it.
        </p>
      </header>

      <section className="guide__section">
        <h2 className="guide__heading">Type styles</h2>
        {styleNames.map((name) => {
          // `styles` infers as a literal object, so a string index needs the
          // cast — the keys ARE the style names, `Object.keys` just loses that.
          const style = spec.styles[name as keyof typeof spec.styles] as TypeStyle
          const m = measured[name]
          return (
            <article className="guide__specimen" key={name}>
              <div className="guide__meta">
                <span className="guide__name">{name}</span>
                <dl className="guide__facts">
                  {FIELDS.map(([field, label]) => {
                    const value = style[field]
                    if (value === undefined || typeof value === 'object') return null
                    return (
                      <div className="guide__fact" key={field}>
                        <dt>{label}</dt>
                        <dd>{String(value)}</dd>
                      </div>
                    )
                  })}
                  {m && (
                    <div className="guide__fact guide__fact--computed">
                      <dt>renders</dt>
                      <dd>
                        {m.size} / {m.leading} · {m.weight} · {m.family}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>
              {/* The utility class Modulato generates for each style — the
                  same declarations the SCSS mixin makes. */}
              <p className={`type-${name} guide__sample`} data-specimen={name}>
                {SAMPLE[name] ?? 'The quick brown fox jumps over the lazy dog. 0123456789'}
              </p>
            </article>
          )
        })}
      </section>

      {scale.length > 0 && (
        <section className="guide__section">
          <h2 className="guide__heading">Scale</h2>
          <p className="guide__note">
            The only sizes this project uses. Tweak’s size control steps through
            them; it never offers a free pixel slider. They are written as the
            px the design was drawn at and ship in <code>rem</code>, so a
            reader’s browser font-size setting reaches the text — layout stays
            in px, so it does not inflate to match. A step written{' '}
            <code>44→90</code> is a fluid pair: those two ends and the viewport
            range in <code>type.ts</code>, with the <code>clamp()</code> solved
            for you.
          </p>
          <ul className="guide__scale">
            {scale.map(([key, value]) => (
              <li className="guide__step" key={key}>
                <span className="guide__name">{key}</span>
                <span
                  className="guide__stepSample"
                  style={{ fontSize: `var(--type-size-${key})` } as CSSProperties}
                >
                  Ag
                </span>
                <span className="guide__stepValue">
                  {typeof value === 'number'
                    ? `${value}px`
                    : typeof value === 'object'
                      ? `${value.min}→${value.max}px`
                      : value}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="guide__section">
        <h2 className="guide__heading">Color</h2>
        <p className="guide__note">
          Every entry in <code>color.ts</code>, read as{' '}
          <code>var(--name)</code> anywhere in the project. Add one there — or
          with the <b>+</b> in the overlay’s Colors tab — and it appears here.
        </p>
        <ul className="guide__swatches">
          {colors.map(([name, value]) => (
            <li className="guide__swatch" key={name}>
              <span className="guide__chip" style={{ background: value }} />
              <span className="guide__name">--{name}</span>
              <span className="guide__stepValue">{value}</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}
