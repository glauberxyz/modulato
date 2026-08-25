import { DEV } from './dev'
import { createTokenRegistry } from './registry'

/**
 * Typography tokens: the type system of a site, as DATA.
 *
 *   // type.ts (project root)
 *   export default typography({
 *     fonts: { sans: 'ui-sans-serif, system-ui, sans-serif' },
 *     fluid: { from: 390, to: 1440 },
 *     scale: { sm: 14, base: 18, lg: 24, xl: 32, '3xl': { min: 48, max: 72 } },
 *     styles: {
 *       headline: { font: 'sans', size: '3xl', leading: 1, tracking: -0.03 },
 *       body: { font: 'sans', size: 'base', leading: 1.7 },
 *     },
 *   })
 *
 * Same argument as motion tokens (`motion.ts`), applied to type: a font size
 * is a value somebody is going to want to nudge while looking at the page, so
 * it belongs in a file that can be read, edited and written back — not spread
 * across stylesheets as literals. `typeCss()` turns this into the CSS custom
 * properties the site's SCSS reads, so the numbers live in ONE place and CSS
 * consumes them by name.
 *
 * Everything here is optional except `styles`. A style names a font and a
 * size from the two catalogs above it; anything not in a catalog is used as
 * written, so `size: { min: 44, max: 90 }` works without inventing a scale
 * step for a one-off.
 *
 * NO UNIT IS EVER WRITTEN IN THIS FILE. A size is the px a design was drawn
 * at and ships in rem; tracking is em; leading and weight are unitless. Which
 * unit a field ships in is a property of the field, so it is decided once
 * here rather than re-argued at every declaration — see `remFrom`.
 */
export function typography<T extends TypographySpec>(spec: T): T {
  return spec
}

/**
 * A size that grows with the viewport, as DATA rather than as a `clamp()`.
 *
 *   display: { min: 44, max: 90 }   // 44px at `from`, 90px at `to`
 *
 * The emitted value is the line through those two points — `clamp(min, a*rem
 * + b*vw, max)` — which is the accessible spelling of a fluid size and the
 * one nobody hand-computes correctly. That is the whole argument for putting
 * it here: the slope depends on the viewport range, so a hand-written
 * `clamp(44px, 9vw, 90px)` encodes a range its author never stated and the
 * next person cannot recover. Two numbers state it.
 *
 * Being two numbers rather than a string is also what keeps the size EDITABLE:
 * Tweak walks the token tree and gives every number a slider, so a fluid step
 * gets two of them. A `clamp()` string is opaque to the overlay — it can name
 * the step but not move it.
 */
export interface FluidValue {
  /** px at the `from` viewport. */
  min: number
  /** px at the `to` viewport. */
  max: number
  /** Viewport width where `min` is reached. Default: `fluid.from`. */
  from?: number
  /** Viewport width where `max` is reached. Default: `fluid.to`. */
  to?: number
}

/** A size step, a leading, a tracking — the values a type style is made of. */
export type TypeValue = number | string | FluidValue

export interface TypeStyle {
  /** A key in `fonts`, or a raw font-family list. */
  font?: string
  /** A key in `scale`, a `{ min, max }` fluid pair, or raw CSS. */
  size?: TypeValue
  /** Unitless line-height (1.4), or a raw CSS value. */
  leading?: TypeValue
  /** letter-spacing. A number is em — the unit type is actually authored in. */
  tracking?: TypeValue
  weight?: TypeValue
  /** text-transform. */
  case?: string
  /** text-wrap: `balance` for headings, `pretty` for prose. */
  wrap?: string
  /**
   * Breakpoint override blocks, named exactly as in modulato.config.ts:
   * `phone: { size: 'xl' }`. Same spelling as a motion token's overrides, and
   * emitted as a media query rather than resolved in JS — CSS is where type
   * is read, so CSS is where the breakpoint has to be answered.
   */
  [breakpoint: string]: TypeValue | TypeStyle | undefined
}

/** A style's per-selector override: which style it modifies, and what changes. */
export interface TypeOverride extends TypeStyle {
  /** The style this selector wears — names the variables the override sets. */
  style?: string
}

export interface TypographySpec {
  /** Named font stacks. `--type-font-<name>`. */
  fonts?: Record<string, string>
  /**
   * The size steps the project uses. `--type-size-<name>`. A bare number is
   * the size in px AS DESIGNED, emitted in rem (see `remFrom`). This is
   * deliberately a closed set: Tweak's size control steps THROUGH these
   * rather than offering a free pixel slider, which is what keeps a site to a
   * scale instead of to forty-one accidental sizes.
   */
  scale?: Record<string, TypeValue>
  /**
   * The viewport range every `{ min, max }` size interpolates across, unless
   * the step names its own. Stated once, here, because a fluid scale whose
   * steps each reach full size at a different width is not a scale.
   */
  fluid?: { from: number; to: number }
  /** The named type styles. Each emits `--type-<name>-*` and a `.type-<name>`. */
  styles: Record<string, TypeStyle>
  /**
   * Per-selector overrides: one element (or one class) departing from its
   * style. Written by Tweak's "save to this class" and read by nothing else.
   *
   *   overrides: { '.home__headline': { style: 'headline', leading: 1.05 } }
   *
   * Emitted as custom properties scoped to the selector, NOT as font
   * declarations — so the element's own `font-size: var(--type-headline-size)`
   * picks the override up wherever that declaration came from, and no
   * stylesheet-order or specificity fight can decide it differently.
   */
  overrides?: Record<string, TypeOverride>
}

/** The one type.ts a project has; its id in the token registry. */
export const TYPE_FILE = '/type.ts'

/** The `<style>` element carrying the generated CSS, in SSR and in the client. */
export const TYPE_STYLE_ID = '__modulato-type'

/**
 * The custom property a type style stamps on the elements wearing it, so
 * Tweak can ask any node on the page which style it is set in.
 *
 * Registered with `inherits: false` (see `typeCss`) so it answers for the
 * element that DECLARES the style rather than for every descendant — which is
 * the difference between "this paragraph is body" and "the class to edit is
 * `.home__tagline`". Where @property is unsupported the value inherits, and
 * the lookup still names the right style; it just can't name the element.
 */
export const TYPE_MARKER = '--modulato-type'

const CSS_PROPS: Array<[keyof TypeStyle & string, string]> = [
  ['font', 'family'],
  ['size', 'size'],
  ['leading', 'leading'],
  ['tracking', 'tracking'],
  ['weight', 'weight'],
  ['case', 'case'],
  ['wrap', 'wrap'],
]

/**
 * The CSS declarations `.type-<name>` makes, in variable-reading form, each
 * with the fallback for a field the style does not declare.
 *
 * The fallbacks are not decoration. `var(--undeclared)` on an INHERITED
 * property is invalid at computed-value time, which resolves to `inherit` —
 * so a style that says nothing about `text-transform` would silently pick up
 * an ancestor's `uppercase`, and one that says nothing about `font-size` would
 * be sized by whatever wraps it. `inherit` is the honest default for the
 * fields a style may legitimately leave to its context; `none` and `wrap` are
 * the initial values for the two a type style should state outright.
 */
const DECLARATIONS: Array<[string, string, string]> = [
  ['font-family', 'family', 'inherit'],
  ['font-size', 'size', 'inherit'],
  ['line-height', 'leading', 'inherit'],
  ['letter-spacing', 'tracking', 'inherit'],
  ['font-weight', 'weight', 'inherit'],
  ['text-transform', 'case', 'none'],
  ['text-wrap', 'wrap', 'wrap'],
]

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)

/**
 * A fluid pair, told apart from a breakpoint block — both are objects sitting
 * in the same positions, and only the shape distinguishes them.
 */
const isFluid = (value: unknown): value is FluidValue =>
  isPlainObject(value) &&
  typeof value.min === 'number' &&
  typeof value.max === 'number'

/** A CSS identifier fragment — variable names are built from author keys. */
const safeKey = (key: string) => key.replace(/[^a-zA-Z0-9_-]/g, '-')

/** The CSS initial root font size — the constant a design's px are drawn at. */
const ROOT_PX = 16

/** The viewport range a fluid size crosses when the spec names none. */
const FLUID_FROM = 390
const FLUID_TO = 1440

/** Enough precision for a sub-pixel step, without emitting float noise. */
const round = (n: number) => Math.round(n * 1e4) / 1e4

/**
 * A designed px size, in rem.
 *
 * THE unit decision of the framework, made once, here. A type size is the one
 * length on a page that a reader may legitimately want bigger without wanting
 * the layout bigger too — that is what the browser's font-size setting is,
 * and rem is the only unit that hears it. Page zoom is the other affordance
 * and it scales everything; both exist because they answer different needs.
 *
 * The author still writes `18`, because 18 is what the design says and a px
 * number is what a designer and an LLM both reason in. The division is the
 * framework's job. The 16 is not an assumption about the reader's setting —
 * it is the CSS initial value, i.e. the size the design was drawn at; a
 * reader who has moved it gets type that moves with them, which is the point.
 *
 * Layout does NOT get this treatment: padding, gaps and container widths stay
 * px, so text can grow without the boxes around it inflating to match.
 */
const remFrom = (px: number) => `${round(px / ROOT_PX)}rem`

/**
 * A fluid pair as the `clamp()` it stands for.
 *
 * The middle term is the line through (from, min) and (to, max), split into
 * the rem part (its intercept) and the vw part (its slope). Keeping an intercept
 * in rem is what makes the result accessible: a size expressed purely in vw
 * ignores the font-size setting AND cannot be enlarged by zoom, since zooming
 * does not change the viewport width in CSS pixels.
 *
 * `min`/`max` are ordered before they are emitted, so a step that shrinks as
 * the viewport grows (legal, occasionally wanted) still clamps to its own two
 * ends rather than pinning to one of them.
 */
function fluidCss(value: FluidValue, spec: TypographySpec): string {
  const from = value.from ?? spec.fluid?.from ?? FLUID_FROM
  const to = value.to ?? spec.fluid?.to ?? FLUID_TO
  const lo = Math.min(value.min, value.max)
  const hi = Math.max(value.min, value.max)
  // A zero-width range has no line through it; the size is simply its top.
  if (to === from) return remFrom(hi)
  const slope = (value.max - value.min) / (to - from)
  const intercept = value.min - slope * from
  return `clamp(${remFrom(lo)}, ${remFrom(intercept)} + ${round(slope * 100)}vw, ${remFrom(hi)})`
}

/**
 * One authored size as the CSS length it means: a fluid pair as its clamp, a
 * number as rem, anything else as the raw CSS it already is.
 */
function sizeCss(value: TypeValue, spec: TypographySpec): string {
  if (isFluid(value)) return fluidCss(value, spec)
  if (typeof value === 'number') return remFrom(value)
  return value
}

/**
 * Resolve one authored field to the CSS text that goes on the right of the
 * colon. Catalog keys become `var()` references so a scale edit reaches every
 * style that names the step; anything else is raw CSS, passed through.
 */
function resolveField(
  field: string,
  value: TypeValue,
  spec: TypographySpec,
): string {
  if (field === 'font' && typeof value === 'string' && spec.fonts?.[value] !== undefined)
    return `var(--type-font-${safeKey(value)})`
  if (field === 'size' && typeof value === 'string' && spec.scale?.[value] !== undefined)
    return `var(--type-size-${safeKey(value)})`
  // A size is a length, and the framework owns which unit that length ships
  // in — a number, a fluid pair or a raw string all go through one place.
  if (field === 'size') return sizeCss(value, spec)
  // Elsewhere a bare number means the unit the field is authored in: em for
  // tracking (tracking is relative to the size by definition, and a px value
  // silently stops being right the moment the size moves), unitless for
  // leading and weight.
  if (typeof value === 'number') {
    if (field === 'tracking') return `${value}em`
    return String(value)
  }
  return value as string
}

function styleVars(
  name: string,
  style: TypeStyle,
  spec: TypographySpec,
  indent: string,
): string[] {
  const out: string[] = []
  for (const [field, suffix] of CSS_PROPS) {
    const value = style[field]
    if (value === undefined) continue
    // An object here is a breakpoint block, which the media-query pass emits —
    // unless it is a fluid pair, which only `size` can be.
    if (isPlainObject(value) && !(field === 'size' && isFluid(value))) continue
    out.push(
      `${indent}--type-${safeKey(name)}-${suffix}: ${resolveField(field, value as TypeValue, spec)};`,
    )
  }
  return out
}

/**
 * Generate the site's type stylesheet from the token module.
 *
 * Runs in Node (SSR inlines the result into <head>, so the first paint is
 * already typeset) and in the browser (Tweak re-runs it on every edit, which
 * is what makes a slider move the real page). One function, so the preview and
 * the shipped site can never disagree.
 *
 * `breakpoints` comes from modulato.config.ts — the same map `useViewport()`
 * and the motion tokens' override blocks read, so `phone:` means one thing
 * across the whole framework.
 */
export function typeCss(
  spec: TypographySpec | null | undefined,
  breakpoints?: Record<string, string> | null,
): string {
  if (!spec?.styles) return ''
  const lines: string[] = []
  // Non-inheriting, so the marker answers for the element that declares the
  // style. Unknown at-rules are ignored by older engines, where the property
  // simply inherits — see TYPE_MARKER.
  lines.push(`@property ${TYPE_MARKER} { syntax: "*"; inherits: false; }`)

  const root: string[] = []
  for (const [name, stack] of Object.entries(spec.fonts ?? {}))
    root.push(`  --type-font-${safeKey(name)}: ${stack};`)
  for (const [name, size] of Object.entries(spec.scale ?? {}))
    root.push(`  --type-size-${safeKey(name)}: ${sizeCss(size, spec)};`)
  for (const [name, style] of Object.entries(spec.styles))
    root.push(...styleVars(name, style, spec, '  '))
  if (root.length) lines.push(`:root {\n${root.join('\n')}\n}`)

  for (const name of Object.keys(spec.styles)) {
    const key = safeKey(name)
    const decls = DECLARATIONS.map(
      ([property, suffix, fallback]) =>
        `  ${property}: var(--type-${key}-${suffix}, ${fallback});`,
    )
    // Declared last so it survives the class being composed into another rule.
    decls.push(`  ${TYPE_MARKER}: ${name};`)
    lines.push(`.type-${key} {\n${decls.join('\n')}\n}`)
  }

  // Breakpoint overrides, in the order the config declares them: they all set
  // :root variables, so among two queries that both match, source order is
  // what decides — and that order is the author's, not this file's.
  for (const [bp, query] of Object.entries(breakpoints ?? {})) {
    const inner: string[] = []
    for (const [name, style] of Object.entries(spec.styles)) {
      const block = style[bp]
      if (!isPlainObject(block) || isFluid(block)) continue
      inner.push(...styleVars(name, block as TypeStyle, spec, '    '))
    }
    if (inner.length) lines.push(`@media ${query} {\n  :root {\n${inner.join('\n')}\n  }\n}`)
  }

  for (const [selector, override] of Object.entries(spec.overrides ?? {})) {
    const { style, ...fields } = override
    // An override with no style names no variables — there is nothing it could
    // set. Skipped rather than guessed: writing `font-size` directly here
    // would be the specificity fight this design exists to avoid.
    if (!style || !spec.styles[style]) continue
    const vars = styleVars(style, fields as TypeStyle, spec, '  ')
    if (vars.length) lines.push(`${selector} {\n${vars.join('\n')}\n}`)
  }

  return lines.join('\n')
}

/**
 * Dev-only typography registry — the same shape as the motion one, and read
 * by the same Save path (`POST /__modulato/tokens` writes `/type.ts` with an
 * AST-preserving edit, exactly as it writes a motion.ts).
 *
 * Separate from `motionRegistry` on purpose: the Tokens panel scopes its files
 * to the current route and is about animation. Typography is global and has
 * its own control surface, so it gets its own store rather than appearing as
 * a stray always-visible card in a list about motion.
 */
export const typeRegistry = createTokenRegistry()

let currentBreakpoints: Record<string, string> | null = null

/** Put the generated CSS in the document, creating the tag if SSR didn't. */
function paint(spec: TypographySpec | null): void {
  if (typeof document === 'undefined') return
  const css = typeCss(spec, currentBreakpoints)
  let el = document.getElementById(TYPE_STYLE_ID)
  if (!el) {
    if (!css) return
    el = document.createElement('style')
    el.id = TYPE_STYLE_ID
    // First in <head>: the utility classes are a floor a page's own rules are
    // meant to be able to raise, and later-wins is what lets them.
    document.head.prepend(el)
  }
  if (el.textContent !== css) el.textContent = css
}

/**
 * Called from the client bootstrap with the project's `type.ts` (or null).
 *
 * In production this only repaints when SSR left no style tag — normally a
 * no-op. In dev it also registers the tokens and repaints on every registry
 * edit, which is what turns a Tweak slider into a change on the page.
 */
export function initTypography(
  spec: TypographySpec | null | undefined,
  breakpoints?: Record<string, string> | null,
): void {
  currentBreakpoints = breakpoints ?? null
  const tokens = spec ?? null
  paint(tokens)
  if (!DEV || typeof window === 'undefined' || !tokens) return
  typeRegistry.register(TYPE_FILE, tokens)
  typeRegistry.subscribe(() => paint(tokens))
}

/**
 * Re-register on HMR of type.ts, from the dev transform @modulato/vite adds.
 *
 * Registering is the whole job: the merge lands in the live object, and
 * `initTypography`'s subscription repaints from THAT — so an edit in the
 * editor and an edit in Tweak converge on one spec. Painting here as well
 * would be wrong, not just redundant: this runs when the module evaluates,
 * which on first load is before boot() has supplied the breakpoints, and the
 * page would be painted once without its media queries and once with.
 */
export function __registerTypography(spec: unknown): void {
  if (!DEV || typeof window === 'undefined') return
  if (!isPlainObject(spec)) return
  typeRegistry.register(TYPE_FILE, spec)
}
