/** A shared element present on both the outgoing and incoming page. */
export interface SharedPair {
  id: string
  from: HTMLElement
  to: HTMLElement
  fromRect: DOMRect
  toRect: DOMRect
  /**
   * The outgoing element sits inside the element that started the navigation.
   *
   * A shared id is a VALUE, so the same one legitimately appears on more than
   * one surface — a list that names every item, and a "next item" card at the
   * foot of each. Both then match on a single move, and the transition gets
   * pairs for something the reader did not touch. That is worse than extra
   * motion: anything measuring a bounding span across the set silently aims at
   * the wrong region.
   *
   * This says which pairs the navigation is actually about, without the
   * transition matching on the site's own class names. False for every pair
   * when there is no trigger — a popstate, or a programmatic `navigate()` —
   * so test it, do not assume it partitions the set.
   */
  withinTrigger: boolean
}

/**
 * Find elements marked `data-shared` (via <Shared>) that exist on BOTH pages.
 * Call after the outgoing page is prepared, so both rects are in final
 * viewport coordinates.
 */
export function collectSharedPairs(
  fromRoot: HTMLElement,
  toRoot: HTMLElement,
  trigger?: HTMLElement | null,
): SharedPair[] {
  const pairs: SharedPair[] = []
  fromRoot.querySelectorAll<HTMLElement>('[data-shared]').forEach((from) => {
    const id = from.dataset.shared
    if (!id) return
    const to = toRoot.querySelector<HTMLElement>(`[data-shared="${CSS.escape(id)}"]`)
    if (!to) return
    pairs.push({
      id,
      from,
      to,
      fromRect: from.getBoundingClientRect(),
      toRect: to.getBoundingClientRect(),
      withinTrigger: !!trigger && trigger.contains(from),
    })
  })
  // Trigger-first, document order within each part. A transition that takes
  // the first pair, or the first N, then gets the ones the reader touched.
  return pairs.sort((a, b) => Number(b.withinTrigger) - Number(a.withinTrigger))
}

/**
 * How the element renders its CONTENT inside its box. Carried onto the clone
 * explicitly because the clone is reparented to <body>: it keeps its own class
 * names, but any rule that reached it through an ANCESTOR — `.figure img
 * { object-fit: contain }`, the common way to style an image — stops matching
 * the moment it leaves that ancestor.
 *
 * `object-fit` is the one that shows. A FLIP animates width and height
 * independently, so unless the two rects share an aspect ratio the box passes
 * through shapes the image never has; at the default `fill` the picture
 * visibly stretches on the way across, and lands correct, which reads as a
 * glitch rather than a setting.
 */
const CONTENT_STYLES = ['objectFit', 'objectPosition', 'borderRadius'] as const

/**
 * FLIP a shared pair: clone the outgoing element into a fixed overlay, hide
 * both originals, fly the clone from rect to rect, then reveal the target.
 * The clone keeps its class names, and the content properties above are
 * copied across so inherited-by-descendant CSS survives the reparenting.
 *
 * `delay` postpones the FLIGHT, not the hiding: the clone is created and both
 * originals are hidden SYNCHRONOUSLY (before the reveal frame paints), so the
 * incoming page's cover can never flash at its final position while you wait.
 * Prefer this over wrapping flipShared in a setTimeout.
 */
export async function flipShared(
  pair: SharedPair,
  options: { duration?: number; easing?: string; delay?: number } = {},
): Promise<void> {
  const { duration = 600, easing = 'cubic-bezier(0.16, 1, 0.3, 1)', delay = 0 } = options
  const clone = pair.from.cloneNode(true) as HTMLElement
  clone.removeAttribute('data-shared')
  clone.setAttribute('data-modulato-clone', '')
  // Read from the SOURCE, before it is hidden — computed style is what the
  // element actually resolved to, whichever selector got there.
  const computed = getComputedStyle(pair.from)
  for (const prop of CONTENT_STYLES) clone.style[prop] = computed[prop]
  Object.assign(clone.style, {
    position: 'fixed',
    margin: '0',
    zIndex: '50',
    pointerEvents: 'none',
    top: `${pair.fromRect.top}px`,
    left: `${pair.fromRect.left}px`,
    width: `${pair.fromRect.width}px`,
    height: `${pair.fromRect.height}px`,
  })
  document.body.appendChild(clone)
  pair.from.style.visibility = 'hidden'
  pair.to.style.visibility = 'hidden'

  if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay))

  try {
    await clone.animate(
      [
        {
          top: `${pair.fromRect.top}px`,
          left: `${pair.fromRect.left}px`,
          width: `${pair.fromRect.width}px`,
          height: `${pair.fromRect.height}px`,
        },
        {
          top: `${pair.toRect.top}px`,
          left: `${pair.toRect.left}px`,
          width: `${pair.toRect.width}px`,
          height: `${pair.toRect.height}px`,
        },
      ],
      { duration, easing, fill: 'forwards' },
    ).finished
  } catch {
    /* animation cancelled — still reveal the target */
  }
  pair.to.style.visibility = ''
  clone.remove()
}
