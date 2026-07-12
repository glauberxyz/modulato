/** A shared element present on both the outgoing and incoming page. */
export interface SharedPair {
  id: string
  from: HTMLElement
  to: HTMLElement
  fromRect: DOMRect
  toRect: DOMRect
}

/**
 * Find elements marked `data-shared` (via <Shared>) that exist on BOTH pages.
 * Call after the outgoing page is prepared, so both rects are in final
 * viewport coordinates.
 */
export function collectSharedPairs(
  fromRoot: HTMLElement,
  toRoot: HTMLElement,
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
    })
  })
  return pairs
}

/**
 * FLIP a shared pair: clone the outgoing element into a fixed overlay, hide
 * both originals, fly the clone from rect to rect, then reveal the target.
 * The clone keeps its class names, so CSS (object-fit, border-radius) applies.
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
