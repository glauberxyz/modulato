/**
 * The PREPARE moment, opened to motion layers.
 *
 * A navigation prepares in a layout effect: the outgoing page is lifted into
 * an absolute overlay, the window is scrolled to where the incoming page
 * lands, and the shared-element pairs are measured — all before anything
 * paints. But the incoming page's own motion runs in PASSIVE effects, and
 * React runs every layout effect before any passive one: at measure time the
 * page's ScrollTriggers do not exist, its pins have not been built, and any
 * element they would position is measured somewhere it will never sit. A
 * figure on a pinned rail measured a whole viewport from its seat.
 *
 * `onPrepare` lets a motion layer close that gap. Callbacks run synchronously
 * inside PREPARE, after the window is at the incoming page's final scroll and
 * BEFORE shared elements are measured — the one moment where scroll-driven
 * layout can establish itself and be measured honestly. @modulato/gsap uses it
 * to create the incoming page's pending motions early; nothing else needs to.
 *
 * The callback receives the incoming page's root element. Runs only on
 * navigations with a transition (both pages present); a cold load has no
 * PREPARE and no measurement problem.
 */
const prepareCallbacks = new Set<(incoming: HTMLElement) => void>()

export function onPrepare(fn: (incoming: HTMLElement) => void): () => void {
  prepareCallbacks.add(fn)
  return () => prepareCallbacks.delete(fn)
}

/** @internal Called by the router inside the PREPARE layout effect. */
export function runPrepare(incoming: HTMLElement): void {
  for (const fn of [...prepareCallbacks]) fn(incoming)
}
