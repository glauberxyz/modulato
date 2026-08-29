import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import type { FluidValue, TypeStyle, TypographySpec } from '../typography'
import type { ColorSpec } from '../colors'
import { viewportStore } from '../viewport'
import { easeRegistry, parseDeclaredEase, type DeclaredEase } from '../eases'
import './styleguide.css'

/**
 * The styleguide: what a site is built out of, in the framework's own chrome.
 *
 * This is a FRAMEWORK surface, not a page of the site. It reads the project's
 * token files — `type.ts` and `color.ts` — and renders
 * them as a specimen sheet whose look is Modulato's and not the project's: a
 * white page, shades of gray, the same Inter the Tweak overlay bundles, every
 * length in px. Two reasons it lives here rather than in the scaffold:
 *
 * 1. It must look the same in every project. When the page was scaffolded
 *    source, styled with the site's own type mixins and colour variables,
 *    every agent that implemented a design re-skinned it along with the rest
 *    of `pages/` — the first thing they rewrite is `color.ts`, at which point
 *    the page's `var(--rule)` is undeclared, it looks broken, and "fix it"
 *    means "redesign it". Markup and CSS in `node_modules` cannot be
 *    redesigned, and a page file that is one component call has nothing in it
 *    worth restyling.
 * 2. The specimens have to render through the DOCUMENT's type: the `.type-*`
 *    rules, the `--type-*` variables, the media queries and the loaded
 *    `@font-face`s. None of those cross a shadow boundary, so unlike the
 *    overlay this is light DOM with a defensive stylesheet — every rule
 *    prefixed, every property the chrome depends on declared — rather than a
 *    shadow root.
 *
 * Everything below is READ, never restated. The numbers beside a specimen are
 * read back off the rendered element with `getComputedStyle`, so the sheet
 * cannot drift from what you are looking at; a wrong number here is a real
 * bug rather than a stale copy.
 *
 * The scaffolded `pages/styleguide/page.tsx` is:
 *
 *   import { Styleguide } from 'modulato/styleguide'
 *   import type from '../../tokens/type'
 *   import colors from '../../tokens/color'
 *   export default () => <Styleguide type={type} colors={colors} />
 *
 * Props rather than the token registries because those are populated by the
 * dev transform only, and this page ships in production (noindexed) — it is a
 * reference a client can be sent a link to.
 *
 * MOTION IS NOT HERE. Numbers with no visible shape are a table nobody reads,
 * and the overlay (✦) is where they are actually worked on — live, against the
 * animation they drive. This sheet is for what can be SEEN.
 */

export interface StyleguideProps {
  /** `type.ts`'s default export. */
  type?: TypographySpec
  /** `color.ts`'s default export. */
  colors?: ColorSpec
  /**
   * Declared curves, as `modulato.config.ts` spells them. Read from the
   * running config when absent, so this is only for a page that wants to show
   * a different set.
   */
  eases?: Record<string, string>
  /** Breakpoints, as `modulato.config.ts` spells them. Read from the running config when absent. */
  breakpoints?: Record<string, string>
  /** Extra `<Section>`s, in the same chrome — a project's own components, say. */
  children?: ReactNode
}

// ————— Section registry: the side nav lists what is on the page —————

interface SectionEntry {
  id: string
  title: string
}

interface GuideContextValue {
  register(entry: SectionEntry): () => void
}

const GuideContext = createContext<GuideContextValue | null>(null)

/**
 * One block of the sheet. The built-in sections are made of this, and so is
 * anything a project adds as children: it registers its title with the side
 * nav on mount, so the nav is always the page and never a list to keep in
 * step. Nothing is rendered above the content — the sheet is the tokens, and
 * a heading and a paragraph over each one is the kind of furniture a specimen
 * does not need.
 */
export function Section({
  id,
  title,
  children,
}: {
  id: string
  /** Not rendered — the side nav is where a section is named. */
  title: string
  children?: ReactNode
}) {
  const guide = useContext(GuideContext)
  useEffect(() => guide?.register({ id, title }), [guide, id, title])
  return (
    <section className="mdl-guide__section" id={`mdl-${id}`} data-mdl-section={id}>
      {children}
    </section>
  )
}

// ————— Helpers shared by the sections —————

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)

const isFluid = (value: unknown): value is FluidValue =>
  isPlainObject(value) && typeof value.min === 'number' && typeof value.max === 'number'

/** The fields of a style, in the order a typographer reads them. */
const FIELDS: Array<keyof TypeStyle & string> = [
  'font',
  'size',
  'leading',
  'tracking',
  'weight',
  'case',
  'wrap',
]

/**
 * The one paragraph every specimen is set in.
 *
 * The same text for every style, in a box of fixed height: a big style fills
 * it in two or three lines and a small one in a dozen, so the amount of text
 * you can read IS the size, and the line breaks, the leading and the wrapping
 * are all on show rather than described. It is the way a foundry sets a
 * specimen, and it is why the sheet says nothing about where a style should
 * be used — that is the project's decision, not the framework's.
 *
 * The paragraph itself is not truncated: it runs its full length and the BOX
 * cuts it, through a mask that fades the last of it out (see the stylesheet).
 * A `line-clamp` was the obvious way and the wrong one — it ends on a whole
 * line, so the box height had to be measured back per style, and the ellipsis
 * sliced descenders through the middle of the glyph.
 */
const SPECIMEN =
  'A typeface has to work at every size a design asks of it, and a name cannot tell you whether it does. Read the setting instead: how the letters space themselves, where the lines break, how ascenders and descenders sit against the leading, whether the numerals 0123456789 hold their place in a column. Every style on this page is set in this same paragraph, so the only thing that changes from one to the next is the type itself — and because the box below is one height for all of them, the amount you can read is itself a measure of the size. Large styles fill it in two or three lines and run out; small ones carry the paragraph most of the way to its end. Look for the shapes that give a face away: the a and the g, the terminals on the c and the s, the distance between a capital I, a lowercase l and the figure 1. Then read a line at speed, and see whether the words hold together or fall apart into letters.'

/** A fluid pair's three or four numbers, printed as `type.ts` states them. */
function fluidText(value: FluidValue, spec: TypographySpec): string {
  const from = value.from ?? spec.fluid?.from ?? 390
  const to = value.to ?? spec.fluid?.to ?? 1440
  return `${value.min} → ${value.max}px across ${from}–${to}px`
}

/**
 * The px a style reaches at its largest — a plain size, or the top end of a
 * fluid pair — resolving a scale key on the way. 0 when the size is raw CSS
 * the sheet cannot read (a `clamp()` written by hand, say), which sorts those
 * to the end rather than guessing at them.
 *
 * Only used for ordering: the specimens run big to small, which is how a
 * scale is read, and is not the order `type.ts` happens to declare them in.
 */
function sizeRank(style: TypeStyle, spec: TypographySpec): number {
  const raw = style.size
  const value =
    typeof raw === 'string' && spec.scale && raw in spec.scale ? spec.scale[raw] : raw
  if (typeof value === 'number') return value
  if (isFluid(value)) return value.max
  return 0
}

/** A scale step or a raw size, as a short value: `18px`, `44→90px`, or the CSS. */
function sizeText(value: unknown): string {
  if (typeof value === 'number') return `${value}px`
  if (isFluid(value)) return `${value.min}→${value.max}px`
  return String(value)
}

/**
 * Which section the reader is in — the one whose heading last crossed the
 * upper third of the viewport, and the last one once the page is scrolled to
 * the bottom (a short final section never reaches the line otherwise).
 *
 * Read off the live layout on scroll rather than with an IntersectionObserver:
 * IO answers "is it visible", and with sections taller than the viewport
 * several are visible at once, so picking ONE still means comparing their
 * positions. This is that comparison, done directly, rAF-throttled to one read
 * per frame. Lenis scrolls through `window.scrollTo`, so smooth scroll fires
 * these events like any other.
 */
function useActiveSection(ids: string[]): string | null {
  const [active, setActive] = useState<string | null>(null)
  const key = ids.join()
  useEffect(() => {
    if (ids.length === 0) return undefined
    let frame = 0
    const read = () => {
      frame = 0
      const line = window.innerHeight / 3
      const atBottom =
        window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2
      let current = ids[0]
      for (const id of ids) {
        const el = document.getElementById(`mdl-${id}`)
        if (el && el.getBoundingClientRect().top <= line) current = id
      }
      setActive(atBottom ? ids[ids.length - 1] : current)
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(read)
    }
    read()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    return () => {
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      if (frame) cancelAnimationFrame(frame)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return active
}

// ————— Sections —————

/** The named styles: what `type.ts` declares, and the type it makes. */
export function TypeStyles({ spec }: { spec: TypographySpec }) {
  // Biggest first. Sort is stable, so two styles at the same size keep the
  // order `type.ts` declares them in.
  const names = Object.keys(spec.styles).sort(
    (a, b) => sizeRank(spec.styles[b], spec) - sizeRank(spec.styles[a], spec),
  )
  // Fields a style leaves undeclared fall back to `inherit`, and on the site
  // what they inherit is the document's `body` style. The stage wears it for
  // the same reason, so a style that says nothing about weight renders here
  // as it does there — and not in the sheet's own Inter.
  const stage = 'body' in spec.styles ? 'mdl-guide__stage type-body' : 'mdl-guide__stage'

  return (
    <Section
      id="type"
      title="Type styles"
    >
      <div>
        {names.map((name) => {
          const style = spec.styles[name]
          // A size naming a scale step resolves to it; a fluid one is worth
          // printing in full because the clamp() is the output and the sheet
          // should print the decision.
          const rawSize = style.size
          const step =
            typeof rawSize === 'string' && spec.scale && rawSize in spec.scale
              ? spec.scale[rawSize]
              : rawSize
          const fluid = isFluid(step) ? fluidText(step, spec) : null
          const blocks = Object.entries(style).filter(
            ([key, value]) => !FIELDS.includes(key as keyof TypeStyle & string) && isPlainObject(value) && !isFluid(value),
          ) as Array<[string, TypeStyle]>

          return (
            <article className="mdl-guide__specimen" key={name}>
              {/* One row: the style's name and every field it declares, each
                  as a label over its value, so the type below gets the full
                  width rather than a column beside a column. */}
              <header className="mdl-guide__specimenHead">
                <h3 className="mdl-guide__name">
                  {name}
                  {/* The variable rather than the `.type-<name>` class: it is
                      what a stylesheet writes when it wants one field of a
                      style, and it names the style in the same breath. A style
                      that declares no size has no such variable, so that one
                      falls back to the class. */}
                  <span className="mdl-guide__dim">
                    {style.size === undefined ? `.type-${name}` : `--type-${name}-size`}
                  </span>
                </h3>
                <dl className="mdl-guide__facts">
                {FIELDS.map((field) => {
                  const value = style[field]
                  if (value === undefined) return null
                  const text =
                    field === 'size'
                      ? isFluid(value)
                        ? sizeText(value)
                        : typeof value === 'string' && step !== value
                          ? `${value} · ${sizeText(step)}`
                          : sizeText(value)
                      : isFluid(value)
                        ? sizeText(value)
                        : String(value)
                  return (
                    <div className="mdl-guide__fact" key={field}>
                      <dt>{field}</dt>
                      <dd>{text}</dd>
                    </div>
                  )
                })}
                {fluid && (
                  <div className="mdl-guide__fact">
                    <dt>fluid</dt>
                    <dd>{fluid}</dd>
                  </div>
                )}
                  {blocks.map(([bp, block]) => (
                    <div className="mdl-guide__fact" key={bp}>
                      <dt>{bp}</dt>
                      <dd>
                        {Object.entries(block)
                          .map(([k, v]) => `${k} ${isFluid(v) ? sizeText(v) : String(v)}`)
                          .join(' · ')}
                      </dd>
                    </div>
                  ))}
                </dl>
              </header>
              <div className={stage}>
                {/* The class Modulato generates for the style — the specimen
                    is the real thing, not a copy of it. */}
                <p className={`type-${name} mdl-guide__sample`} data-mdl-specimen={name}>
                  {SPECIMEN}
                </p>
              </div>
            </article>
          )
        })}
      </div>
    </Section>
  )
}

/** The palette: one swatch per key in `color.ts`. */
export function Swatches({ colors }: { colors: ColorSpec }) {
  const entries = Object.entries(colors)
  if (entries.length === 0) return null
  return (
    <Section
      id="colors"
      title="Colors"
    >
      <ul className="mdl-guide__swatches">
        {entries.map(([name, value]) => (
          <li className="mdl-guide__swatch" key={name}>
            <span className="mdl-guide__chip" style={{ background: value }} />
            <span className="mdl-guide__key">--{name}</span>
            <span className="mdl-guide__dim">{value}</span>
          </li>
        ))}
      </ul>
    </Section>
  )
}

/**
 * A cubic-bezier drawn in its unit square, with a dot running it.
 *
 * The square is the frame every easing diagram uses — time across, progress
 * up — so the diagonal is the linear ease and the curve's distance from it is
 * what the easing DOES. The unit square IS the container: the viewBox is
 * exactly 0–100 in both directions, and the SVG does not clip, so a curve that
 * overshoots (y outside 0–1) is drawn past the frame rather than cut off by
 * it — which is the overshoot being visible, and the point of drawing it.
 *
 * The dot is two animations, not one: an outer group carries it across at a
 * constant rate (that is time), and the circle inside rises with the curve as
 * its timing function (that is the easing). Running one animation along the
 * path instead would move at constant ARC LENGTH, which is a different thing
 * and would show the easing wrong — slow exactly where the curve is steep.
 */
function Curve({ ease }: { ease: DeclaredEase }) {
  const [x1, y1, x2, y2] = ease.points
  const d = `M 0 100 C ${x1 * 100} ${100 - y1 * 100}, ${x2 * 100} ${100 - y2 * 100}, 100 0`
  return (
    <svg className="mdl-guide__curve" viewBox="0 0 100 100" aria-hidden>
      <rect className="mdl-guide__curveBox" x="0" y="0" width="100" height="100" />
      <path className="mdl-guide__curveLinear" d="M 0 100 L 100 0" />
      <path className="mdl-guide__curvePath" d={d} />
      <g className="mdl-guide__curveTime">
        <circle
          className="mdl-guide__curveDot"
          cx="0"
          cy="100"
          r="4.5"
          style={{ animationTimingFunction: ease.css } as CSSProperties}
        />
      </g>
    </svg>
  )
}

/** The curves `modulato.config.ts` declares, as both spellings and a drawing. */
export function Eases({ eases }: { eases?: Record<string, string> }) {
  const [declared, setDeclared] = useState<DeclaredEase[]>([])
  useEffect(() => {
    if (eases) {
      setDeclared(
        Object.entries(eases).flatMap(([name, value]) => {
          const ease = parseDeclaredEase(name, value)
          return ease ? [ease] : []
        }),
      )
      return undefined
    }
    return easeRegistry.subscribe(setDeclared)
  }, [eases])
  if (declared.length === 0) return null
  return (
    <Section
      id="eases"
      title="Eases"
    >
      <ul className="mdl-guide__eases">
        {declared.map((ease) => (
          <li className="mdl-guide__ease" key={ease.name}>
            <Curve ease={ease} />
            <span className="mdl-guide__key">{ease.name}</span>
            <span className="mdl-guide__dim">{ease.css}</span>
          </li>
        ))}
      </ul>
    </Section>
  )
}

/** The breakpoints the site is built against. */
export function Breakpoints({ breakpoints }: { breakpoints?: Record<string, string> }) {
  // Read after mount: the server renders with the defaults, and the client
  // learns the configured map at boot — so the SSR HTML must not print a set
  // hydration would then have to correct.
  const [map, setMap] = useState<Record<string, string> | null>(breakpoints ?? null)
  useEffect(() => {
    if (!breakpoints) setMap(viewportStore.breakpoints())
  }, [breakpoints])
  if (!map) return null
  return (
    <Section
      id="breakpoints"
      title="Breakpoints"
    >
      <ul className="mdl-guide__rows">
        {Object.entries(map).map(([name, query]) => (
          <li className="mdl-guide__row mdl-guide__row--bp" key={name}>
            <span className="mdl-guide__key">{name}</span>
            <span className="mdl-guide__value">{query}</span>
          </li>
        ))}
        <li className="mdl-guide__row mdl-guide__row--bp">
          <span className="mdl-guide__key">desktop</span>
          <span className="mdl-guide__value mdl-guide__dim">everything else</span>
        </li>
      </ul>
    </Section>
  )
}

// ————— The page —————

const NAV_TITLES: Record<string, string> = {
  type: 'Type styles',
  colors: 'Colors',
  eases: 'Eases',
  breakpoints: 'Breakpoints',
}

/**
 * The whole sheet. Sections render for whatever is handed over; the side nav
 * lists what the page ended up with.
 */
export function Styleguide({
  type,
  colors,
  eases,
  breakpoints,
  children,
}: StyleguideProps) {
  // Sections announce themselves on mount, so a project's own <Section>s show
  // up in the nav beside the built-in ones. Mount order is document order.
  const [sections, setSections] = useState<SectionEntry[]>([])
  const guide = useMemo<GuideContextValue>(
    () => ({
      register(entry) {
        setSections((list) => (list.some((s) => s.id === entry.id) ? list : [...list, entry]))
        return () => setSections((list) => list.filter((s) => s.id !== entry.id))
      },
    }),
    [],
  )

  const active = useActiveSection(sections.map((s) => s.id))

  const jump = (id: string) => (event: React.MouseEvent) => {
    // A hash link would be a navigation to the router; this is a scroll.
    event.preventDefault()
    document.getElementById(`mdl-${id}`)?.scrollIntoView({ block: 'start' })
  }

  return (
    <GuideContext.Provider value={guide}>
      {/* `data-modulato-styleguide` is the hook a project's stylesheet hides
          its shell on: `body:has([data-modulato-styleguide]) .menu { display:
          none }`. CSS rather than a route check in the shell component so it
          is already true in the SSR HTML — no frame of shell before hydration
          — and so the project keeps the last word about its own shell. */}
      <main className="mdl-guide" data-modulato-styleguide>
        <aside className="mdl-guide__side">
          {/* The site's shell is expected to step aside on this page (see the
              data attribute on the root), so the sheet carries its own way
              out. A plain link: the router picks it up like any other. */}
          <a className="mdl-guide__back" href="/">
            ← Back to site
          </a>
          <nav className="mdl-guide__nav" aria-label="Sections">
            {sections.map((s) => (
              <a
                className={`mdl-guide__navLink${s.id === active ? ' is-active' : ''}`}
                // `aria-current` and not just a class: a screen reader gets the
                // same answer the highlight gives everyone else.
                aria-current={s.id === active ? 'true' : undefined}
                href={`#mdl-${s.id}`}
                key={s.id}
                onClick={jump(s.id)}
              >
                {NAV_TITLES[s.id] ?? s.title}
              </a>
            ))}
          </nav>
        </aside>
        {/* No headings of any kind: not for the page (the browser tab and the
            site's own title say what this is) and not per section (the side
            nav names them). What is left is the tokens themselves. */}
        <div className="mdl-guide__main">
          {type && <TypeStyles spec={type} />}
          {colors && <Swatches colors={colors} />}
          <Eases eases={eases} />
          <Breakpoints breakpoints={breakpoints} />
          {children}
        </div>
      </main>
    </GuideContext.Provider>
  )
}
