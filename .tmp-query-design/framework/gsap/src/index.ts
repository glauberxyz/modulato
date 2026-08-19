import gsap from 'gsap'
import { CustomEase } from 'gsap/CustomEase'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { easeRegistry, getMotionSpeed, usePage, useViewport } from 'modulato'
// A NAMESPACE import, and deliberately so. `onPrepare` arrived in modulato
// 0.5.0, and the peer range here is deliberately wide — CONTRIBUTING keeps it
// at `>=0.1.0 <1.0.0` so a core minor does not cascade these plugins to 1.0.0.
// Named-importing something an older core does not export is a link-time
// error, which would turn a version skew into a blank page; read off the
// namespace and it is simply absent, so the PREPARE seating is skipped and
// everything else still works.
import * as modulato from 'modulato'

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

interface ScrollTriggerApi {
  update: () => void
  refresh: () => void
  clearScrollMemory?: (scrollRestoration?: string) => void
  getAll: () => Array<{
    trigger?: Element | null
    disable: (revert?: boolean) => void
    enable: (reset?: boolean) => void
    /** The element this trigger pins, when it pins one. */
    pin?: Element | null
    /** The scrub setting the trigger was created with, when it has one. */
    vars?: { scrub?: number | boolean }
    /** The animation the trigger drives, when it drives one. */
    animation?: {
      progress: (value: number, suppressEvents?: boolean) => unknown
      pause: () => unknown
    }
    progress: number
  }>
}

/** `gsap.core.globals()` returns registered plugins (runtime API, untyped). */
function scrollTrigger(): ScrollTriggerApi | undefined {
  const globals = (gsap.core as { globals?: () => Record<string, unknown> }).globals?.() ?? {}
  return globals.ScrollTrigger as ScrollTriggerApi | undefined
}

let scrollMemoryCleared = false

function wireScrollTrigger(lenis: { on: (e: 'scroll', cb: () => void) => void }): void {
  const ST = scrollTrigger()
  if (!ST) return
  if (!scrollMemoryCleared) {
    scrollMemoryCleared = true
    // ScrollTrigger snapshots history.scrollRestoration when it initialises
    // and RE-APPLIES the snapshot on kill/refresh. If it initialised before
    // the router set 'manual' (module scope runs early), the snapshot is
    // 'auto' — and the first page unmount would hand scroll restoration back
    // to the browser, which then natively yanks the viewport on every
    // Back/Forward. This is GSAP's own SPA remedy: replace the snapshot.
    ST.clearScrollMemory?.('manual')
  }
  if (scrollTriggerWired.has(lenis)) return
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
/**
 * Motions that have MOUNTED but whose create effect has not run yet.
 *
 * A page mounts during its own transition, and `useMotion` creates in a
 * passive effect — which React runs after every layout effect, including the
 * router's PREPARE, where shared elements are measured. So at measure time
 * this page's ScrollTriggers do not exist and anything they position (a
 * pinned rail, a scrubbed transform) is measured somewhere it will never
 * sit. The router's `onPrepare` hook runs after the window reaches the
 * incoming page's scroll and before that measurement: draining the pending
 * builds there means scroll-driven layout exists, at the right scroll, in
 * time to be measured.
 *
 * Only instances that mounted in the current commit can be here un-built —
 * anything older had its passive effect run — so draining with the incoming
 * page's element is safe: they ARE the incoming page's motions. The passive
 * effect then adopts what was built instead of building twice.
 */
const pendingBuilds = new Set<(pageEl: HTMLElement) => void>()
if (typeof window !== 'undefined') {
  modulato.onPrepare?.((incoming: HTMLElement) => {
    for (const build of [...pendingBuilds]) build(incoming)
    // A scrubbed trigger built with its start already crossed may LERP toward
    // its position rather than snap (that is what scrub smoothing is). The
    // measurement needs the destination, not the journey — force each
    // scrubbed animation to its trigger's progress before anyone measures.
    const ST = scrollTrigger()
    if (ST)
      for (const t of ST.getAll())
        if (t.vars?.scrub && t.animation && incoming.contains(t.trigger as Node))
          t.animation.progress(t.progress, true)
  })
}

/**
 * Nothing a page creates may run before that page is on screen.
 *
 * A scroll-triggered tween fires the INSTANT its trigger is built, if the
 * start line is already crossed — and building happens at mount, which is
 * mid-transition. Whether a page noticed was an accident of its own height:
 * in the demo, a chapter whose head was short enough to put the first section
 * above the line played its whole reveal behind the flight, while a taller one
 * missed the line and looked correct for no better reason.
 *
 * So anything the trigger has already started is wound back and paused, and
 * the triggers are disabled until `active` — pins excepted, since those are
 * layout, and scrubs excepted, since they were just seated deliberately at
 * PREPARE and winding them back would undo that.
 */
function holdUntilActive(el: HTMLElement): void {
  const ST = scrollTrigger()
  if (!ST) return
  for (const t of ST.getAll()) {
    if (!t.trigger || !el.contains(t.trigger)) continue
    if (!t.vars?.scrub && t.animation) {
      t.animation.progress(0)
      t.animation.pause()
    }
    if (!t.pin) t.disable(false)
  }
}

export function useMotion(
  create: (scope: MotionScope) => void | (() => void),
  deps: unknown[] = [],
): void {
  const { element, lenis, phase } = usePage()
  const createRef = useRef(create)
  createRef.current = create
  // `build` can be called from PREPARE, outside this component's render, so
  // the phase it checks has to come from a ref rather than the closure.
  const phaseRef = useRef(phase)
  phaseRef.current = phase

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

  // One build, two callers. The passive effect below is the ordinary path;
  // the PREPARE drain (pendingBuilds, above) is the early one, used only for
  // the mount that happens mid-transition. `built` is the handshake between
  // them: whoever runs first builds, the other adopts.
  //
  // The element comes as a PARAMETER because the two callers know it
  // differently: the effect reads it from page context, but at PREPARE time
  // the context still holds null — PageScope registers its element in a ref
  // callback and re-renders, and that render has not happened when the
  // router's layout effect runs. The router knows the element anyway (its own
  // ref map), and hands it through onPrepare.
  const built = useRef<{
    el: HTMLElement
    ctx: gsap.Context
    userCleanup: void | (() => void)
  } | null>(null)
  const build = (el: HTMLElement) => {
    let userCleanup: void | (() => void) = undefined
    const ctx = gsap.context(() => {
      userCleanup = createRef.current({ element: el, q: gsap.utils.selector(el), gsap })
    }, el)
    built.current = { el, ctx, userCleanup }
    if (phaseRef.current !== 'active') holdUntilActive(el)
  }
  const teardown = () => {
    const b = built.current
    if (!b) return
    if (typeof b.userCleanup === 'function') b.userCleanup()
    b.ctx.revert()
    built.current = null
  }

  // Pending from mount until the passive create first runs. A LAYOUT effect,
  // because it must precede the router's own layout effect in the mounting
  // commit — child layout effects run before the parent's, which is the same
  // ordering PageScope's Lenis handoff already relies on.
  useLayoutEffect(() => {
    const entry = (pageEl: HTMLElement) => {
      if (!built.current) build(pageEl)
    }
    pendingBuilds.add(entry)
    return () => {
      pendingBuilds.delete(entry)
    }
  }, [])

  useEffect(() => {
    if (!element) return undefined
    // Already built at PREPARE — adopt it: this effect's cleanup owns the
    // teardown from here (dep changes, replay, unmount).
    if (built.current?.el !== element) {
      teardown()
      build(element)
    }
    return teardown
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [element, replayTick, breakpoint, reducedMotion, ...deps])

  // A page mounts DURING its own transition: the outgoing page is still in
  // the document as an absolute overlay, this one may still be hidden, and
  // the scroll position is not final. Every ScrollTrigger created above
  // measured its start/end against THAT arrangement. Once the transition
  // commits — outgoing gone, height real, scroll settled — those positions
  // are stale, which shows up as sections that never reveal until you
  // scroll, or that arrived already revealed.
  //
  // While a page is entering or leaving, its triggers are disabled outright.
  // A transition scrolls the WINDOW — to land the incoming page, to lift the
  // outgoing one into its overlay — and a page being transitioned has not
  // moved under the reader at all. Left enabled, those triggers read the
  // jump as scrolling and fire: a chapter's whole body would reveal itself
  // in the moment before it flies away.
  //
  // EXCEPT the ones that pin. A pin is not a reaction to scrolling, it is
  // layout: it holds a section against the fold and gives the document the
  // height that holding costs. Disabled, the section drops back into flow
  // and everything below it slides up — so a page that pins spent its whole
  // transition mis-laid-out and snapped into place on the refresh that lands
  // with `active`. That is a second of wrongness to avoid firing an
  // animation, and it is the wrong trade. Their scrubs are seated at PREPARE
  // (see pendingBuilds) and the window does not move again inside a
  // transition, so leaving them enabled costs nothing.
  //
  // Declared after the create effect so it runs after it on the same commit.
  useEffect(() => {
    if (!element) return undefined
    const ST = scrollTrigger()
    if (!ST) return undefined
    const mine = () =>
      ST.getAll().filter((s) => !s.pin && s.trigger && element.contains(s.trigger))
    if (phase === 'active') {
      ST.refresh()
      return undefined
    }
    for (const s of mine()) s.disable(false)
    return () => {
      for (const s of mine()) s.enable(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [element, phase, replayTick, breakpoint, reducedMotion, ...deps])
}
