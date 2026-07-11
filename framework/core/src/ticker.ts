export type TickerCallback = (time: number, delta: number) => void

const callbacks = new Set<TickerCallback>()
let rafId: number | null = null
let last = 0

function loop(time: number) {
  if (!callbacks.size) {
    rafId = null
    last = 0
    return
  }
  const delta = last ? time - last : 0
  last = time
  for (const callback of Array.from(callbacks)) callback(time, delta)
  rafId = requestAnimationFrame(loop)
}

/**
 * The framework's single RAF loop. Page Lenis instances and any per-frame
 * user code share this one loop — per-page RAF *ownership* without per-page
 * RAF *loops*. Starts on first subscriber, stops when the last one leaves.
 */
export const ticker = {
  /** Subscribe. Returns an unsubscribe function. */
  add(callback: TickerCallback): () => void {
    callbacks.add(callback)
    if (rafId === null && typeof window !== 'undefined') {
      last = 0
      rafId = requestAnimationFrame(loop)
    }
    return () => ticker.remove(callback)
  },
  remove(callback: TickerCallback): void {
    callbacks.delete(callback)
  },
}
