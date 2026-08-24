import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { TypeStyle } from 'modulato'
import spec from '../../type'

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
 * Colors are read the same way, from the custom properties `styles/tokens.scss`
 * declares on `:root`.
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

/**
 * The color variables declared on `:root`, read from the live stylesheet.
 *
 * Walking the CSSOM rather than keeping a list here: a list would be a second
 * copy of tokens.scss, and the first time somebody added a color without
 * updating it, this page would start lying. Same-origin stylesheets only —
 * a cross-origin one throws on `.cssRules`, which is why the try/catch is not
 * optional.
 */
function useRootColors(): Array<[string, string]> {
  const [vars, setVars] = useState<Array<[string, string]>>([])
  useEffect(() => {
    const names = new Set<string>()
    for (const sheet of Array.from(document.styleSheets)) {
      let rules: CSSRuleList
      try {
        rules = sheet.cssRules
      } catch {
        continue
      }
      for (const rule of Array.from(rules)) {
        if (!(rule instanceof CSSStyleRule) || rule.selectorText !== ':root') continue
        for (const property of Array.from(rule.style)) {
          // The type system's own variables have their own section above.
          if (property.startsWith('--') && !property.startsWith('--type-'))
            names.add(property)
        }
      }
    }
    const computed = getComputedStyle(document.documentElement)
    setVars(
      [...names]
        .map((name) => [name, computed.getPropertyValue(name).trim()] as [string, string])
        // Colors only: an easing curve is a token, but it is not a swatch.
        .filter(([, value]) => /^(#|rgb|hsl|oklch|color\()/i.test(value))
        .sort(),
    )
  }, [])
  return vars
}

export default function Styleguide() {
  const styleNames = Object.keys(spec.styles)
  const [scope, measured] = useMeasured([styleNames.join()])
  const colors = useRootColors()
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
          const style = spec.styles[name] as TypeStyle
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
            them; it never offers a free pixel slider.
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
                  {typeof value === 'number' ? `${value}px` : value}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="guide__section">
        <h2 className="guide__heading">Color</h2>
        <p className="guide__note">
          Read from the custom properties <code>styles/tokens.scss</code>{' '}
          declares on <code>:root</code> — add one there and it appears here.
        </p>
        <ul className="guide__swatches">
          {colors.map(([name, value]) => (
            <li className="guide__swatch" key={name}>
              <span className="guide__chip" style={{ background: value }} />
              <span className="guide__name">{name}</span>
              <span className="guide__stepValue">{value}</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}
