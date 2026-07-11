import gsap from 'gsap'
import { useEffect, useRef } from 'react'
import { usePage } from 'modulato'

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
  }, [element, ...deps])
}
