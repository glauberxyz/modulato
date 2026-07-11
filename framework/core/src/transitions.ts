import type { SharedPair } from './flip'
import type { RouteInfo } from './types'

export interface TransitionRunContext {
  /**
   * Both pages are mounted when `run` is called. The outgoing page has been
   * lifted to an absolute overlay (visually unmoved); the incoming page sits
   * underneath, laid out at its final scroll position.
   */
  from: { element: HTMLElement; route: RouteInfo }
  to: { element: HTMLElement; route: RouteInfo }
  /** The clicked link element, when navigation came from a click. */
  trigger: HTMLElement | null
  /** Matched <Shared> pairs, rects pre-measured — feed them to flipShared(). */
  shared: SharedPair[]
}

export interface TransitionDef {
  /** Also apply this transition to the reverse route pair. */
  symmetric?: boolean
  run: (ctx: TransitionRunContext) => Promise<void> | void
}

/** Identity helper for typed transition files: `export default transition({...})` */
export function transition(def: TransitionDef): TransitionDef {
  return def
}

export interface TransitionEntry {
  from: string
  to: string
  load: () => Promise<{ default: TransitionDef }>
}

export interface TransitionsManifest {
  entries: TransitionEntry[]
  fallback: (() => Promise<{ default: TransitionDef }>) | null
}

/** Exact pair → reversed pair (if symmetric) → default.ts → null (built-in). */
export async function resolveTransition(
  manifest: TransitionsManifest,
  fromId: string,
  toId: string,
): Promise<TransitionDef | null> {
  const exact = manifest.entries.find((e) => e.from === fromId && e.to === toId)
  if (exact) return (await exact.load()).default
  const reversed = manifest.entries.find((e) => e.from === toId && e.to === fromId)
  if (reversed) {
    const def = (await reversed.load()).default
    if (def.symmetric) return def
  }
  if (manifest.fallback) return (await manifest.fallback()).default
  return null
}

/**
 * Lift the outgoing page into an absolute overlay, offset by the current
 * scroll so it appears unmoved, and scroll the viewport to where the incoming
 * page should land. Runs before every transition.
 */
export function prepareOutgoing(fromEl: HTMLElement, scrollY: number): void {
  Object.assign(fromEl.style, {
    position: 'absolute',
    top: `${-window.scrollY}px`,
    left: '0',
    width: '100%',
    zIndex: '1',
    pointerEvents: 'none',
  })
  window.scrollTo(0, scrollY)
}

/** Built-in default: crossfade. Pages are already prepared by the framework. */
export async function crossfade({
  from,
  to,
}: {
  from: { element: HTMLElement }
  to: { element: HTMLElement }
}): Promise<void> {
  const duration = 450
  const out = from.element.animate([{ opacity: 1 }, { opacity: 0 }], {
    duration,
    easing: 'ease',
    fill: 'forwards',
  })
  const inn = to.element.animate([{ opacity: 0 }, { opacity: 1 }], {
    duration,
    easing: 'ease',
    fill: 'forwards',
  })
  await Promise.all([out.finished, inn.finished]).catch(() => {
    /* cancelled — commit anyway */
  })
}
