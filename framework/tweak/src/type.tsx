import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { ModulatoDevHandle } from 'modulato/client'
import type { TokenValue } from 'modulato'
import { Button } from './ui/button'
import { Slider } from './ui/slider'
import { cn } from './ui/utils'
import { OVERLAY_HOST } from './dom'
import { typeFile, useHandle } from './handle'
import { openInEditor, saveTokens } from './save'

/**
 * Type Mode: click any text on the page and edit the type style it is set in,
 * where it sits.
 *
 * The gap this closes is the one between seeing a heading that is two points
 * too big and finding the rule that made it. In a project with a `type.ts`
 * every style stamps its own name onto the elements wearing it (see
 * TYPE_MARKER in modulato's typography module), so the page can answer "what
 * am I looking at" itself, and this reads that answer back: the style's name,
 * the class that carries it, and the file:line that authored the element.
 *
 * Edits go into the SAME token registry the panel edits, so the preview is not
 * a preview — it is the type system, changed, with the stylesheet regenerated
 * from it. Save writes `type.ts` through the same endpoint a motion.ts uses.
 *
 * DELIBERATELY A MODE, not a bare click handler. "Click any text" would mean
 * every link on the site stops navigating while the tool is installed, and a
 * dev overlay that breaks the site it is inspecting is not a dev overlay. The
 * toggle sits in the panel next to Replay, and only while it is on are clicks
 * swallowed.
 */

const SOURCE_ATTR = 'data-modulato-source'
const MARKER = '--modulato-type'

let enabled = false
const listeners = new Set<() => void>()

export const typeMode = {
  get enabled() {
    return enabled
  },
  set(value: boolean) {
    if (enabled === value) return
    enabled = value
    for (const listener of listeners) listener()
  },
  toggle() {
    typeMode.set(!enabled)
  },
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
}

export function useTypeMode(): boolean {
  return useSyncExternalStore(
    typeMode.subscribe,
    () => enabled,
    () => false,
  )
}

interface Target {
  el: HTMLElement
  /** The type style the element is set in, or '' when it wears none. */
  style: string
  /** Class selectors the element carries, most specific first. */
  selectors: string[]
  /** `data-modulato-source`, when the element came from project JSX. */
  source: string | null
  rect: DOMRect
}

/** The style name an element DECLARES — see TYPE_MARKER on why it's not inherited. */
function markerOf(el: Element): string {
  return getComputedStyle(el).getPropertyValue(MARKER).trim().replace(/^["']|["']$/g, '')
}

/**
 * Class selectors an override could reasonably be scoped to, best first.
 *
 * "Longest wins" was the first rule and it was wrong in the ordinary case:
 * `.styles__h` and `.col-aside` are both nine characters, so a heading offered
 * to scope its type to a GRID COLUMN — a class that says where the element
 * sits, not what it is. Rank by what the class means instead:
 *
 * - a BEM element (`block__element`) names this thing, so it leads;
 * - a modifier (`block--variant`) names a variant of it;
 * - everything else is a block, a layout class or a utility, and only gets a
 *   turn when there is nothing better.
 *
 * The generated `type-<style>` classes are dropped outright. Scoping an
 * override to `.type-subhead` would mean "every element in the subhead style,
 * except written as an override" — the style tab already does that, better.
 */
function selectorsOf(el: Element): string[] {
  const rank = (c: string) => (c.includes('__') ? 0 : c.includes('--') ? 1 : 2)
  return [...el.classList]
    .filter((c) => !!c && !c.startsWith('type-'))
    .sort((a, b) => rank(a) - rank(b) || b.length - a.length)
    .map((c) => `.${CSS.escape(c)}`)
}

/** Does this element hold text of its own, rather than only holding boxes? */
function hasOwnText(el: Element): boolean {
  for (const node of el.childNodes)
    if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) return true
  return false
}

/**
 * Did this event come from the overlay's own UI?
 *
 * A composed event retargets to the shadow HOST, so this one check covers
 * every control the panel and this popup render. It is NOT redundant with the
 * hit-test in `resolve`: the click listener below runs in the CAPTURE phase
 * and calls `stopPropagation`, which means a click it decides to swallow never
 * reaches its target at all. Get that wrong for a button inside the popup and
 * the button is simply dead — no error, no handler, nothing. Asking the event
 * where it came from answers that before any coordinate is consulted.
 */
function fromOverlay(event: Event): boolean {
  const target = event.target
  return target instanceof Element && !!target.closest(`#${OVERLAY_HOST}`)
}

/**
 * The node the pointer was last over, so an unchanged one costs nothing.
 *
 * `markerOf` is a `getComputedStyle` per ancestor, and resolving on every
 * pointermove would force a style recalc per ancestor per frame across a whole
 * page of type — on a heavy page that is the mode itself making the site feel
 * slow. A pointer travelling across one paragraph hits the same node hundreds
 * of times; only a change of node can change the answer.
 */
let lastUnder: Element | null = null
let lastTarget: Target | null = null

function resolve(x: number, y: number): Target | null {
  const under = document.elementFromPoint(x, y)
  if (under && under === lastUnder && lastTarget) {
    // The rect is the one thing that moves without the node changing.
    lastTarget = { ...lastTarget, rect: lastTarget.el.getBoundingClientRect() }
    return lastTarget
  }
  lastUnder = under
  lastTarget = null
  if (!under || !(under instanceof HTMLElement)) return null
  // Composed events retarget to the shadow host, so this covers everything the
  // overlay itself draws — including this popup.
  if (under.closest(`#${OVERLAY_HOST}`)) return null

  // Walk up to the element that DECLARES a type style. Failing that, settle
  // for the nearest one that actually contains text: a node with no style is
  // still worth reporting on, and reporting on its wrapper would be a lie.
  let styled: HTMLElement | null = under
  while (styled && !markerOf(styled)) styled = styled.parentElement
  const el = styled ?? (hasOwnText(under) ? under : (under.closest('p, h1, h2, h3, h4, h5, h6, li, span, a, button, td, th, figcaption, blockquote') as HTMLElement | null))
  if (!el) return null

  lastTarget = {
    el,
    style: markerOf(el),
    selectors: selectorsOf(el),
    source: el.closest(`[${SOURCE_ATTR}]`)?.getAttribute(SOURCE_ATTR) ?? null,
    rect: el.getBoundingClientRect(),
  }
  return lastTarget
}

type Spec = {
  fonts?: Record<string, string>
  scale?: Record<string, TokenValue | FluidPair>
  styles?: Record<string, Record<string, unknown>>
  overrides?: Record<string, Record<string, unknown>>
}

/** A `{ min, max }` size step — two numbers the panel can put sliders on. */
type FluidPair = { min: number; max: number; from?: number; to?: number }

const isFluid = (value: unknown): value is FluidPair =>
  !!value &&
  typeof value === 'object' &&
  typeof (value as FluidPair).min === 'number' &&
  typeof (value as FluidPair).max === 'number'

/**
 * A scale step as the reader should see it beside its key.
 *
 * A fluid pair prints as its two ends rather than as `[object Object]` — and
 * as the two ends rather than as the emitted `clamp()`, because the ends are
 * what the file says and what the sliders in the Typography tab move.
 */
export function formatSize(value: unknown): string {
  if (isFluid(value)) return `${value.min}→${value.max}`
  return String(value)
}

/**
 * The number a step sorts by, so ◀ and ▶ mean smaller and larger.
 *
 * A fluid step sorts by its MIDPOINT: ordering by either end alone gets it
 * wrong the moment two steps have different ranges — a 40→190 statement reads
 * as smaller than a 44→90 display by its min, and the stepper would walk them
 * in an order the page contradicts.
 */
function sortValue(value: unknown): number {
  if (isFluid(value)) return (value.min + value.max) / 2
  const n = typeof value === 'number' ? value : Number.parseFloat(String(value))
  return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY
}

function specOf(handle: ModulatoDevHandle): Spec | null {
  const entry = handle.type?.list()[0]
  return (entry?.tokens as Spec | undefined) ?? null
}

/**
 * Scale keys, smallest first.
 *
 * Sorted by their size rather than trusted in declaration order, because the
 * stepper's ◀ and ▶ have to mean smaller and larger. A fluid `{ min, max }`
 * step sorts by its midpoint; a step that is still raw CSS (`clamp(...)`)
 * cannot be ordered against a number, so it keeps its authored position at
 * the end — one more reason to write the pair instead of the string.
 */
function scaleKeys(spec: Spec | null): string[] {
  const entries = Object.entries(spec?.scale ?? {})
  return entries
    .map(([key, value], index) => ({ key, sort: sortValue(value), index }))
    .sort((a, b) => a.sort - b.sort || a.index - b.index)
    .map((e) => e.key)
}

const FIELDS = ['size', 'leading', 'tracking'] as const
type Field = (typeof FIELDS)[number]

/** Number, or null when the authored value is raw CSS this control can't drive. */
function asNumber(value: unknown): number | null {
  if (typeof value === 'number') return value
  if (typeof value !== 'string') return null
  const n = Number.parseFloat(value)
  return Number.isFinite(n) && /^-?[\d.]+(?:em|rem|px)?$/.test(value.trim()) ? n : null
}

/**
 * lucide a-large-small — the type glyph, shared by the launcher button, the
 * on-page badge and the popup's header.
 *
 * Was the literal characters "Tt". They rendered correctly and read as one
 * letter anyway: at 12px in a 32px circle the lowercase t is a stem and a
 * crossbar, and the pair is 10px wide. Lucide's own `type` glyph is a capital
 * T and would have had the same problem; this one is two letterforms at
 * DIFFERENT sizes, which is the subject — a scale — rather than a letter
 * somebody typed.
 *
 * Inlined, like every other icon here: an icon library is not worth a
 * dependency for a dev overlay.
 */
export function TypeIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M21 14h-5" />
      <path d="M16 16v-3.5a2.5 2.5 0 0 1 5 0V16" />
      <path d="M4.5 13h6" />
      <path d="m3 16 4.5-9 4.5 9" />
    </svg>
  )
}

/** lucide chevron-down — the same glyph the panel's ease control carries. */
function ChevronDownIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 py-1">
      <span className="w-14 shrink-0 text-xs text-muted-foreground">{label}</span>
      {children}
    </div>
  )
}

/**
 * Font size, as a pick from the project's scale — never a pixel slider.
 *
 * That is the whole point of a scale: a site with six sizes stays legible as a
 * system, and a site with a free slider ends up with forty-one sizes that
 * nobody chose. A select rather than steppers, because a scale is a short list
 * you choose FROM — stepping through it one press at a time is the same
 * decision made slowly, and it hides the other steps while you make it.
 *
 * A value the scale does not contain — a one-off, written inline as a `{ min,
 * max }` pair or as raw CSS — leads the list as its own option rather than
 * being silently snapped away. Picking a real step from the list replaces it,
 * which is the only way back into the scale and should stay one gesture.
 */
function SizeSelect({
  keys,
  value,
  scale,
  onChange,
}: {
  keys: string[]
  value: unknown
  scale: Record<string, TokenValue | FluidPair>
  onChange: (key: string) => void
}) {
  const current = typeof value === 'string' ? value : ''
  // An inline size is an object or a number, so it names no key — it shows as
  // the empty option, labelled with what it actually is.
  const inline = !current && value !== undefined && value !== null ? formatSize(value) : ''
  const options = keys.map((key) => ({
    value: key,
    label: `${key} · ${formatSize(scale[key])}`,
  }))
  if (current && !keys.includes(current))
    options.unshift({ value: current, label: `${current} (not in the scale)` })
  return (
    <div className="relative flex h-9 min-w-0 flex-1 items-center rounded-full border border-border bg-background">
      <select
        className="size-full cursor-pointer appearance-none rounded-full bg-transparent pr-8 pl-3.5 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        value={current}
        onChange={(e) => onChange(e.target.value)}
      >
        {!current && <option value="">{inline ? `${inline} (not in the scale)` : '—'}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDownIcon className="pointer-events-none absolute right-3 text-muted-foreground" />
    </div>
  )
}

function NumberRow({
  label,
  value,
  min,
  max,
  step,
  suffix,
  onChange,
}: {
  label: string
  value: number | null
  min: number
  max: number
  step: number
  suffix: string
  onChange: (v: number) => void
}) {
  if (value === null)
    return (
      <Row label={label}>
        <span className="flex h-9 min-w-0 flex-1 items-center rounded-full border border-border bg-background px-3.5 text-xs text-muted-foreground">
          set in CSS — edit it in type.ts
        </span>
      </Row>
    )
  return (
    <Row label={label}>
      <Slider
        className="min-w-0 flex-1"
        label={`${parseFloat(value.toFixed(3))}${suffix}`}
        min={Math.min(min, value)}
        max={Math.max(max, value)}
        step={step}
        value={[value]}
        onValueChange={(v: number | readonly number[]) =>
          onChange(Array.isArray(v) ? v[0] : (v as number))
        }
      />
    </Row>
  )
}

const POPUP_WIDTH = 268

function Popup({
  handle,
  target,
  onClose,
}: {
  handle: ModulatoDevHandle
  target: Target
  onClose: () => void
}) {
  // 'style' edits the type style itself — every element wearing it moves.
  // 'selector' edits only elements carrying the chosen class. Picked BEFORE
  // editing rather than at save time, so what the page shows while a slider
  // moves is what the save will keep.
  const [scope, setScope] = useState<'style' | 'selector'>('style')
  const [selector, setSelector] = useState(target.selectors[0] ?? '')
  const [status, setStatus] = useState('')

  const version = useSyncExternalStore(
    useCallback((cb: () => void) => handle.type?.subscribe(cb) ?? (() => {}), [handle]),
    () => handle.type?.version ?? 0,
  )

  const spec = specOf(handle)
  const styleDef = (target.style ? spec?.styles?.[target.style] : null) ?? null
  const overrideDef = selector ? (spec?.overrides?.[selector] ?? null) : null
  const keys = scaleKeys(spec)
  const dirty = handle.type?.dirty(typeFile(handle)) ?? []

  // A breakpoint block shadows the base value at this width, so an edit here
  // would write a number the reader cannot see move. Say so rather than
  // letting the slider look broken.
  const bp = handle.viewport.breakpoint
  const shadowed = !!(styleDef && bp && typeof styleDef[bp] === 'object')

  const read = (field: Field): unknown =>
    scope === 'selector'
      ? (overrideDef?.[field] ?? styleDef?.[field])
      : styleDef?.[field]

  const write = (field: Field, value: TokenValue) => {
    if (!handle.type || !target.style) return
    if (scope === 'selector') {
      if (!selector) return
      // The override has to name the style it modifies — that is what tells
      // the generator which variables the selector is allowed to set.
      handle.type.set(typeFile(handle), ['overrides', selector, 'style'], target.style)
      handle.type.set(typeFile(handle), ['overrides', selector, field], value)
    } else {
      handle.type.set(typeFile(handle), ['styles', target.style, field], value)
    }
  }

  const save = async () => {
    if (!handle.type || !dirty.length) return
    setStatus('saving…')
    try {
      await saveTokens(typeFile(handle), dirty)
      handle.type.markSaved(typeFile(handle))
      setStatus(`saved ${typeFile(handle)}`)
    } catch (error) {
      setStatus(`save failed: ${error instanceof Error ? error.message : String(error)}`)
    }
    setTimeout(() => setStatus(''), 2500)
  }

  // Below the element, or above it when there is no room — and clamped into
  // the layout viewport, which excludes a classic scrollbar gutter.
  const vw = document.documentElement.clientWidth
  const vh = document.documentElement.clientHeight
  const below = target.rect.bottom + 8
  const top = below + 220 < vh ? below : Math.max(8, target.rect.top - 228)
  const left = Math.max(8, Math.min(target.rect.left, vw - POPUP_WIDTH - 8))

  return (
    <div
      className="pointer-events-auto absolute flex flex-col gap-2 rounded-2xl border bg-muted p-2 text-xs shadow-[0_24px_64px_-12px_rgba(0,0,0,0.3)]"
      style={{ top, left, width: POPUP_WIDTH }}
      data-version={version}
      data-lenis-prevent=""
    >
      <div className="rounded-xl bg-background p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-1.5">
            <TypeIcon className="size-4 shrink-0" />
            <span className="truncate text-[13px] font-semibold">
              {target.style || 'no type style'}
            </span>
          </span>
          <button
            className="shrink-0 cursor-pointer text-muted-foreground hover:text-foreground"
            title="close"
            aria-label="close"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        {target.source && (
          <button
            className="mt-1 block max-w-full cursor-pointer truncate text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            title="open in editor"
            onClick={() => void openInEditor(target.source as string)}
          >
            {target.source}
          </button>
        )}
      </div>

      {!target.style ? (
        <div className="rounded-xl bg-background p-3 text-muted-foreground">
          This text wears no type style — its font properties were declared
          directly. Move them into a style in <code>type.ts</code> and include it
          here, and this panel can edit it.
        </div>
      ) : !spec ? (
        <div className="rounded-xl bg-background p-3 text-muted-foreground">
          no type.ts registered — create one at tokens/type.ts.
        </div>
      ) : (
        <>
          <div className="rounded-xl bg-background p-3">
            {/* Two targets for the same edit, named in full: a style is worn by
                many elements, a class by these ones. */}
            <div className="flex h-8 rounded-full bg-secondary">
              {(
                [
                  ['style', target.style],
                  ['selector', selector || 'no class'],
                ] as Array<['style' | 'selector', string]>
              ).map(([key, label]) => (
                <button
                  key={key}
                  className={cn(
                    'h-full min-w-0 flex-1 cursor-pointer truncate rounded-full px-2 text-xs transition-colors',
                    scope === key
                      ? 'bg-primary font-medium text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                    key === 'selector' && !selector && 'cursor-not-allowed opacity-40',
                  )}
                  title={
                    key === 'style'
                      ? `edit the "${target.style}" style — every element set in it moves`
                      : selector
                        ? `edit only ${selector}`
                        : 'this element carries no class to scope an override to'
                  }
                  disabled={key === 'selector' && !selector}
                  onClick={() => setScope(key)}
                >
                  {label}
                </button>
              ))}
            </div>
            {scope === 'selector' && target.selectors.length > 1 && (
              <select
                className="mt-1.5 h-8 w-full cursor-pointer rounded-full border border-border bg-background px-3 text-xs text-foreground outline-none"
                value={selector}
                onChange={(e) => setSelector(e.target.value)}
              >
                {target.selectors.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            )}
            {shadowed && (
              <div className="mt-1.5 text-[11px] text-muted-foreground">
                “{target.style}” has a <b>{bp}</b> block, which wins at this
                width — edits here change the base value. Use the panel’s
                Typography card to reach the {bp} tab.
              </div>
            )}
          </div>

          <div className="rounded-xl bg-background p-3">
            <Row label="Size">
              <SizeSelect
                keys={keys}
                value={read('size')}
                scale={(spec.scale ?? {}) as Record<string, TokenValue | FluidPair>}
                onChange={(key) => write('size', key)}
              />
            </Row>
            <NumberRow
              label="Leading"
              value={asNumber(read('leading'))}
              min={0.8}
              max={2.2}
              step={0.01}
              suffix=""
              onChange={(v) => write('leading', v)}
            />
            <NumberRow
              label="Kerning"
              value={asNumber(read('tracking'))}
              min={-0.08}
              max={0.24}
              step={0.002}
              suffix="em"
              onChange={(v) => write('tracking', v)}
            />
            <div className="mt-2 flex gap-1.5">
              <Button
                size="sm"
                className="h-9 flex-1 rounded-full text-xs"
                disabled={!dirty.length}
                onClick={() => void save()}
              >
                Save{dirty.length ? ` (${dirty.length})` : ''}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="h-9 flex-1 rounded-full text-xs"
                disabled={!dirty.length}
                onClick={() => handle.type?.reset(typeFile(handle))}
              >
                Reset
              </Button>
            </div>
            {status && <div className="mt-1.5 text-[11px] text-muted-foreground">{status}</div>}
          </div>
        </>
      )}
    </div>
  )
}

export function TypeMode() {
  const handle = useHandle()
  const on = useTypeMode()
  const [hover, setHover] = useState<Target | null>(null)
  const [selected, setSelected] = useState<Target | null>(null)
  const pointer = useRef({ x: -1, y: -1 })
  // Read by listeners mounted for the layer's whole life, so they must not
  // close over a stale render's values.
  const state = useRef({ on: false, frozen: false })
  state.current = { on, frozen: !!selected }

  useEffect(() => {
    // Leaving the mode drops the cache: a type.ts edit made in between can
    // change which style an element is in, and a remembered answer would be
    // the pre-edit one.
    lastUnder = null
    lastTarget = null
    if (!on) {
      setHover(null)
      setSelected(null)
    }
  }, [on])

  useEffect(() => {
    if (!on) return undefined

    const onMove = (e: PointerEvent) => {
      if (fromOverlay(e)) return
      pointer.current = { x: e.clientX, y: e.clientY }
      // With the popup open the outline stays on what it names: chasing the
      // pointer would mean the card and the highlight described different
      // elements the moment you reached for a slider.
      if (state.current.frozen) return
      setHover(resolve(e.clientX, e.clientY))
    }
    // Capture, so the site's own handlers never see the click — in this mode
    // a click is a question about the type, not a navigation.
    const onClick = (e: MouseEvent) => {
      if (fromOverlay(e)) return
      const found = resolve(e.clientX, e.clientY)
      if (!found) return
      e.preventDefault()
      e.stopPropagation()
      setSelected(found)
      setHover(found)
    }
    const swallow = (e: MouseEvent) => {
      if (fromOverlay(e)) return
      if (resolve(e.clientX, e.clientY)) {
        e.preventDefault()
        e.stopPropagation()
      }
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      // Escape closes the card first and leaves the mode second — one key,
      // two steps, so it never drops you out of the mode you meant to stay in.
      if (state.current.frozen) setSelected(null)
      else typeMode.set(false)
    }
    // Keep the outline and the card on the element as the page moves.
    const refresh = () => {
      setSelected((s) => (s ? { ...s, rect: s.el.getBoundingClientRect() } : s))
      if (!state.current.frozen) {
        const { x, y } = pointer.current
        setHover(x >= 0 ? resolve(x, y) : null)
      }
    }

    window.addEventListener('pointermove', onMove, { passive: true, capture: true })
    window.addEventListener('click', onClick, true)
    window.addEventListener('mousedown', swallow, true)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('scroll', refresh, { passive: true, capture: true })
    window.addEventListener('resize', refresh, { passive: true })
    return () => {
      window.removeEventListener('pointermove', onMove, true)
      window.removeEventListener('click', onClick, true)
      window.removeEventListener('mousedown', swallow, true)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('scroll', refresh, true)
      window.removeEventListener('resize', refresh)
    }
  }, [on])

  if (!on || !handle) return null
  const marked = selected ?? hover

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2147483645,
        pointerEvents: 'none',
        overflow: 'hidden',
        font: '500 11px/1.4 "Inter Tweak", ui-sans-serif, system-ui, sans-serif',
      }}
    >
      {marked && (
        <>
          <div
            style={{
              position: 'absolute',
              top: marked.rect.top,
              left: marked.rect.left,
              width: marked.rect.width,
              height: marked.rect.height,
              // Same marker Inspect draws, so the two modes read as one tool
              // rather than two overlays that happened to ship together — see
              // the note there for why it is one dotted mid-tone line.
              outline: '1px dotted oklch(0.55 0 0)',
              outlineOffset: '1px',
            }}
          />
          {/* The Tt badge: tiny, at the element's corner, naming the style. */}
          <div
            style={{
              position: 'absolute',
              top: Math.max(0, marked.rect.top - 20),
              left: Math.max(0, marked.rect.left),
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              height: 18,
              padding: '0 6px',
              borderRadius: 4,
              background: 'oklch(0.15 0 0)',
              color: 'oklch(0.99 0 0)',
              whiteSpace: 'nowrap',
            }}
          >
            <TypeIcon width={12} height={12} />
            {marked.style && <span>{marked.style}</span>}
          </div>
        </>
      )}
      {selected && (
        <Popup handle={handle} target={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}
