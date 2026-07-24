import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type Lenis from 'lenis'
import { DEV } from './dev'
import { applyEnhancers, type EnhancerDef } from './enhance'
import { getMotionSpeed } from './motion'
import { ticker } from './ticker'
import type { Entry, RouteInfo } from './types'

export type PagePhase = 'entering' | 'active' | 'leaving'

export interface PageApi {
  route: RouteInfo
  /**
   * 'entering' while this page is the incoming side of a transition,
   * 'leaving' while it is the outgoing side, 'active' otherwise.
   */
  phase: PagePhase
  /** The page's root element. Null during SSR and the very first render. */
  element: HTMLElement | null
  /**
   * This page's Lenis smooth-scroll instance. Null until ready, or when the
   * page's config sets `scroll: false`. Stopped during transitions, started
   * when the page becomes active, destroyed on unmount.
   */
  lenis: Lenis | null
}

const PageContext = createContext<PageApi | null>(null)

const NO_ENHANCERS: EnhancerDef[] = []
export const EnhancersContext = createContext<EnhancerDef[]>(NO_ENHANCERS)

/** The page a component lives in: lifecycle phase, root element, scroll. */
export function usePage(): PageApi {
  const ctx = useContext(PageContext)
  if (!ctx)
    throw new Error('[modulato] usePage must be used inside a page (under <PageOutlet>)')
  return ctx
}

export interface ScrollEvent {
  scroll: number
  limit: number
  velocity: number
  progress: number
}

// Site-wide scroll bus: every page Lenis pipes its frames here, so PERSISTENT
// shell components (canvases, WebGL scenes, cursors) can subscribe once and
// keep receiving scroll across navigations — page instances come and go, the
// bus doesn't. Only one page owns scroll at a time, so there's no double-fire.
const scrollBus = new Set<(e: ScrollEvent) => void>()

function emitScroll(e: ScrollEvent) {
  for (const listener of scrollBus) listener(e)
}

/**
 * Per-frame callback on the framework's single RAF ticker, auto-removed on
 * unmount. Works anywhere — pages or persistent shell components (custom
 * canvases, WebGL scenes). `delta` is ms since the previous frame.
 *
 * Callbacks run on the motion clock: in dev, Tweak Mode slow-mo scales
 * `delta`, and `time` advances by the scaled deltas so time-based loops slow
 * the same as delta-based ones. Lenis stays on the raw ticker — slow-mo is
 * for animation, not input smoothing.
 */
export function useTicker(callback: (time: number, delta: number) => void): void {
  const cbRef = useRef(callback)
  cbRef.current = callback
  useEffect(() => {
    let clock: number | null = null
    return ticker.add((time, delta) => {
      const scaled = DEV ? delta * getMotionSpeed() : delta
      clock = clock === null ? time : clock + scaled
      cbRef.current(clock, scaled)
    })
  }, [])
}

/**
 * Subscribe to smooth-scroll frames (Lenis under the hood).
 * Inside a page: that page's own scroll, unsubscribed on unmount.
 * In the shell (outside <PageOutlet>): the ACTIVE page's scroll, surviving
 * navigations — feed it to anything persistent (r3f scenes, canvases).
 */
export function useScroll(callback: (e: ScrollEvent) => void): void {
  const page = useContext(PageContext)
  const inPage = page !== null
  const lenis = page?.lenis ?? null
  const cbRef = useRef(callback)
  cbRef.current = callback
  useEffect(() => {
    const handler = (e: ScrollEvent) => cbRef.current(e)
    if (!inPage) {
      scrollBus.add(handler)
      return () => {
        scrollBus.delete(handler)
      }
    }
    if (!lenis) return undefined
    lenis.on('scroll', handler)
    return () => lenis.off('scroll', handler)
  }, [inPage, lenis])
}

interface PageScopeProps {
  entry: Entry
  phase: PagePhase
  /** The incoming page mounts hidden; the framework reveals it (no flicker). */
  hidden: boolean
  registerEl: (key: string, el: HTMLElement | null) => void
}

/**
 * Wraps every mounted page: owns the root element, the page's Lenis instance
 * (created on mount, destroyed on unmount — the strict lifecycle), and runs
 * enhancers against the mounted subtree.
 */
export function PageScope({ entry, phase, hidden, registerEl }: PageScopeProps) {
  const [element, setElement] = useState<HTMLElement | null>(null)
  const [lenis, setLenis] = useState<Lenis | null>(null)
  const enhancers = useContext(EnhancersContext)
  const phaseRef = useRef(phase)
  phaseRef.current = phase

  const ref = useCallback(
    (el: HTMLElement | null) => {
      registerEl(entry.key, el)
      setElement(el)
    },
    [entry.key, registerEl],
  )

  // Per-page Lenis on the shared ticker. Dynamically imported so SSR and
  // scroll-disabled pages never pay for it.
  useEffect(() => {
    if (!element || entry.scroll === false) return undefined
    let cancelled = false
    let instance: Lenis | null = null
    let detach: (() => void) | null = null
    // `restore` is router-level scroll memory, not a Lenis option.
    const { restore: _restore, ...lenisOptions } = entry.scroll ?? {}
    void import('lenis').then(({ default: LenisCtor }) => {
      if (cancelled) return
      instance = new LenisCtor({ autoRaf: false, ...lenisOptions })
      instance.on('scroll', emitScroll)
      detach = ticker.add((time) => instance!.raf(time))
      // Scroll stays locked while a transition choreographs both pages.
      if (phaseRef.current !== 'active') instance.stop()
      setLenis(instance)
    })
    return () => {
      cancelled = true
      detach?.()
      instance?.destroy()
      setLenis(null)
    }
  }, [element, entry.scroll])

  useEffect(() => {
    if (!lenis) return
    if (phase === 'active') lenis.start()
    else lenis.stop()
  }, [lenis, phase])

  const route = useMemo<RouteInfo>(
    () => ({ id: entry.routeId, path: entry.path, params: entry.params }),
    [entry],
  )

  useEffect(() => {
    if (!element || !enhancers.length) return undefined
    return applyEnhancers(enhancers, element, route)
  }, [element, enhancers, route])

  const api = useMemo<PageApi>(
    () => ({ route, phase, element, lenis }),
    [route, phase, element, lenis],
  )

  return (
    <div
      data-page={entry.routeId}
      style={hidden ? { visibility: 'hidden' } : undefined}
      ref={ref}
    >
      <PageContext.Provider value={api}>
        <entry.Component {...entry.props} />
      </PageContext.Provider>
    </div>
  )
}
