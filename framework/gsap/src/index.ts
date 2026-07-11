import gsap from 'gsap'
import { useEffect, useRef, useState } from 'react'
import { getMotionSpeed, usePage } from 'modulato'

const DEV: boolean =
  typeof import.meta !== 'undefined' &&
  Boolean((import.meta as { env?: { DEV?: boolean } }).env?.DEV)

// Tweak Mode slow-mo: the core dispatches `modulato:speed`, GSAP follows.
// Also sync on load — this module may be code-split in after a speed change.
if (DEV && typeof window !== 'undefined') {
  window.addEventListener('modulato:speed', (event) => {
    gsap.globalTimeline.timeScale((event as CustomEvent<number>).detail)
  })
  gsap.globalTimeline.timeScale(getMotionSpeed())
}

export interface MotionScope {
  /** The page's root element. */
  element: HTMLElement
  /** Scoped selector — matches only inside this page's subtree. */
  q: <T extends Element = HTMLElement>(selector: string) => T[]
  gsap: typeof gsap
}

/**
 * Page-scoped GSAP. `create` runs inside a `gsap.context()` bound to the
 * page element: selector strings in tweens are scoped to the page, and every
 * animation/ScrollTrigger created inside is reverted automatically when the
 * page unmounts — Lisergia's manual destroy() bookkeeping, made structural.
 *
 *   useMotion(({ q, gsap }) => {
 *     gsap.from(q('.home__card'), { y: 80, stagger: 0.08 })
 *   })
 *
 * Return a function for extra teardown (observers, listeners); it runs before
 * the context reverts.
 */
export function useMotion(
  create: (scope: MotionScope) => void | (() => void),
  deps: unknown[] = [],
): void {
  const { element } = usePage()
  const createRef = useRef(create)
  createRef.current = create

  // Tweak Mode replay: re-create (revert + run) on `modulato:replay-motions`,
  // so token edits apply to running loops and scroll-linked animations.
  const [replayTick, setReplayTick] = useState(0)
  useEffect(() => {
    if (!DEV) return undefined
    const onReplay = () => setReplayTick((t) => t + 1)
    window.addEventListener('modulato:replay-motions', onReplay)
    return () => window.removeEventListener('modulato:replay-motions', onReplay)
  }, [])

  useEffect(() => {
    if (!element) return undefined
    let userCleanup: void | (() => void)
    const ctx = gsap.context(() => {
      userCleanup = createRef.current({
        element,
        q: gsap.utils.selector(element),
        gsap,
      })
    }, element)
    return () => {
      if (typeof userCleanup === 'function') userCleanup()
      ctx.revert()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [element, replayTick, ...deps])
}
