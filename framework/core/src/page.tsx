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
import { applyEnhancers, type EnhancerDef } from './enhance'
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

/**
 * Subscribe to this page's smooth-scroll frames (Lenis under the hood).
 * Auto-unsubscribes on page unmount. No-op when the page disables scroll.
 */
export function useScroll(callback: (e: ScrollEvent) => void): void {
  const { lenis } = usePage()
  const cbRef = useRef(callback)
  cbRef.current = callback
  useEffect(() => {
    if (!lenis) return undefined
    const handler = (e: ScrollEvent) => cbRef.current(e)
    lenis.on('scroll', handler)
    return () => lenis.off('scroll', handler)
  }, [lenis])
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
    void import('lenis').then(({ default: LenisCtor }) => {
      if (cancelled) return
      instance = new LenisCtor({ autoRaf: false, ...(entry.scroll ?? {}) })
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
