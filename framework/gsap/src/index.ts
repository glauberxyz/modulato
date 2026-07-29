import gsap from 'gsap'
import { CustomEase } from 'gsap/CustomEase'
import { useEffect, useRef, useState } from 'react'
import { easeRegistry, getMotionSpeed, usePage, useViewport } from 'modulato'

const DEV: boolean =
  typeof import.meta !== 'undefined' &&
  Boolean((import.meta as { env?: { DEV?: boolean } }).env?.DEV)

// Curves declared in modulato.config.ts become real GSAP eases, so a token
// can say `ease: 'swoosh'` and a tween just works. This must land before any
// intro/useMotion resolves a string ease — an unknown ease name silently
// falls back to quad.out instead of erroring, which reads as "my custom ease
// does nothing". Subscribing (rather than reading list() once) makes the
// registration independent of whether this module is evaluated before or
// after boot(). A name that collides with a built-in is SKIPPED: creating
// 'power2.out' would clobber GSAP's own for the whole page.
gsap.registerPlugin(CustomEase)
const registered = new Set<string>()
easeRegistry.subscribe((eases) => {
  for (const ease of eases) {
    if (registered.has(ease.name)) continue
    if (gsap.parseEase(ease.name)) {
      console.warn(
        `[modulato] ease "${ease.name}" collides with a built-in GSAP ease — rename it in modulato.config.ts`,
      )
      continue
    }
    CustomEase.create(ease.name, ease.points.join(','))
    registered.add(ease.name)
  }
})

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

// Lenis smooth-scroll drives GSAP's ScrollTrigger, once per page Lenis
// instance. Without this, scroll-linked animations read native scroll and
// jitter against the smoothed position. The listener dies with the page's
// lenis.destroy() on unmount, so no manual teardown is needed.
const scrollTriggerWired = new WeakSet<object>()

/** `gsap.core.globals()` returns registered plugins (runtime API, untyped). */
function scrollTrigger(): { update: () => void; refresh: () => void } | undefined {
  const globals = (gsap.core as { globals?: () => Record<string, unknown> }).globals?.() ?? {}
  return globals.ScrollTrigger as { update: () => void; refresh: () => void } | undefined
}

function wireScrollTrigger(lenis: { on: (e: 'scroll', cb: () => void) => void }): void {
  const ST = scrollTrigger()
  if (!ST || scrollTriggerWired.has(lenis)) return
  scrollTriggerWired.add(lenis)
  lenis.on('scroll', () => ST.update())
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
  const { element, lenis, phase } = usePage()
  const createRef = useRef(create)
  createRef.current = create

  // Sync ScrollTrigger to this page's Lenis when both are present (idempotent).
  useEffect(() => {
    if (lenis) wireScrollTrigger(lenis)
  }, [lenis])

  // Responsive: revert + re-run when the breakpoint (or reduced-motion)
  // changes, so resolveTokens() reads fresh values — write the animation
  // once, vary the numbers per breakpoint.
  const { breakpoint, reducedMotion } = useViewport()

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
  }, [element, replayTick, breakpoint, reducedMotion, ...deps])

  // A page mounts DURING its own transition: the outgoing page is still in
  // the document as an absolute overlay, this one may still be hidden, and
  // the scroll position is not final. Every ScrollTrigger created above
  // measured its start/end against THAT arrangement. Once the transition
  // commits — outgoing gone, height real, scroll settled — those positions
  // are stale, which shows up as sections that never reveal until you
  // scroll, or that arrived already revealed. Declared after the create
  // effect so it runs after it on the same commit.
  useEffect(() => {
    if (!element || phase !== 'active') return
    scrollTrigger()?.refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [element, phase, replayTick, breakpoint, reducedMotion, ...deps])
}
