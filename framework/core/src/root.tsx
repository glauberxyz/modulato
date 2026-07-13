import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
} from 'react'
import { RouterContext, type RouterApi } from './context'
import { checkDuplicateSharedIds, DEV } from './dev'
import type { EnhancerDef } from './enhance'
import { collectSharedPairs } from './flip'
import { syncWaapiSpeed } from './motion'
import { EnhancersContext } from './page'
import { resolveEntry } from './resolve'
import {
  crossfade,
  prepareOutgoing,
  resolveTransition,
  type TransitionsManifest,
} from './transitions'
import type { Entry, NavPhase, RouteDef, RouteInfo, RouterState } from './types'

interface ModulatoRootProps {
  routes: RouteDef[]
  App: ComponentType
  initial: RouterState
  transitions?: TransitionsManifest
  enhancers?: EnhancerDef[]
  content?: Record<string, unknown>
}

const NO_ENHANCERS: EnhancerDef[] = []

function toInfo(entry: Entry): RouteInfo {
  return { id: entry.routeId, path: entry.path, params: entry.params }
}

// useLayoutEffect on the client (fires before paint — the transition's
// "well-defined moment"), silent no-op fallback during SSR.
const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect

// Scroll memory (session-only): every page's position is recorded when you
// navigate away; link navigations back to a page with `scroll.restore` land
// there instead of at the top. A fresh landing has no entry — starts at 0.
const scrollMemory = new Map<string, number>()

/**
 * Owns router state and the navigation lifecycle. Rendered by both the server
 * (static, effects never run) and the client (live).
 */
export function ModulatoRoot({
  routes,
  App,
  initial,
  transitions,
  enhancers,
  content,
}: ModulatoRootProps) {
  const [state, setState] = useState<RouterState>(initial)
  const [phase, setPhase] = useState<NavPhase>('idle')
  const stateRef = useRef(state)
  stateRef.current = state
  const els = useRef(new Map<string, HTMLElement>())
  const token = useRef(0)
  const seq = useRef(0)
  const targetScroll = useRef(0)
  const trigger = useRef<HTMLElement | null>(null)

  const registerEl = useCallback((key: string, el: HTMLElement | null) => {
    if (el) els.current.set(key, el)
    else els.current.delete(key)
  }, [])

  const navigate = useCallback(
    async (path: string, opts: { pop?: boolean; scrollY?: number } = {}) => {
      const url = new URL(path, window.location.origin)
      const pathname = url.pathname
      if (pathname === stateRef.current.current.path && !opts.pop) return

      const t = ++token.current
      setPhase('loading')

      // Record the departing page's position for scroll memory (both link
      // and popstate navigations — a Back-visited page can be returned to
      // via a link later).
      scrollMemory.set(stateRef.current.current.path, window.scrollY)

      let entry = null
      try {
        entry = await resolveEntry(
          routes,
          pathname,
          `${pathname}#${++seq.current}`,
          undefined,
          content,
        )
      } catch (error) {
        console.error('[modulato] navigation failed', error)
      }
      if (t !== token.current) return
      if (!entry) {
        window.location.assign(path)
        return
      }

      if (!opts.pop) {
        // Remember where we were, so Back can restore it.
        window.history.replaceState(
          { ...window.history.state, __modulatoScroll: window.scrollY },
          '',
        )
        window.history.pushState({}, '', url.pathname + url.search)
      }
      // Explicit target (popstate) → remembered position (scroll.restore
      // pages, link navs) → top.
      const remembered =
        entry.scroll !== false && entry.scroll?.restore
          ? scrollMemory.get(pathname)
          : undefined
      targetScroll.current = opts.scrollY ?? remembered ?? 0
      setPhase('transition')
      setState((s) => ({ current: s.current, next: entry }))
    },
    [routes, content],
  )

  // The transition lifecycle, in well-defined moments:
  //   1. MOUNT   — React commits both pages; the incoming one is hidden (outlet).
  //   2. PREPARE — pre-paint (layout effect): lift the outgoing page into an
  //                overlay, set the target scroll, measure shared pairs.
  //                Nothing has been painted yet: no flicker is possible.
  //   3. REVEAL + RUN — the incoming page is revealed in the same synchronous
  //                task that starts the transition's animations, so the first
  //                painted frame is already animation frame zero.
  //   4. COMMIT  — old page unmounts, state settles, title updates.
  const nextKey = state.next?.key
  useIsomorphicLayoutEffect(() => {
    if (!nextKey) return undefined
    const from = state.current
    const next = state.next!
    let cancelled = false

    const fromEl = els.current.get(from.key)
    const toEl = els.current.get(next.key)

    let shared: ReturnType<typeof collectSharedPairs> = []
    if (fromEl && toEl) {
      // PREPARE — synchronous, before this frame paints.
      prepareOutgoing(fromEl, targetScroll.current)
      shared = collectSharedPairs(fromEl, toEl)
      if (DEV) {
        checkDuplicateSharedIds(fromEl, from.routeId)
        checkDuplicateSharedIds(toEl, next.routeId)
      }
    }

    const commit = () => {
      if (cancelled) return
      trigger.current = null
      if (next.meta.title) document.title = next.meta.title
      setState({ current: next, next: null })
      setPhase('idle')
    }

    void (async () => {
      if (!fromEl || !toEl) return commit()
      try {
        // Module resolution may await (first visit) — the incoming page is
        // still hidden, the outgoing overlay looks unchanged: safe to paint.
        const def = transitions
          ? await resolveTransition(transitions, from.routeId, next.routeId)
          : null
        if (cancelled) return

        // REVEAL + RUN in one task: transitions start their animations
        // synchronously, so hidden → animation-start happens between paints.
        toEl.style.visibility = 'visible'
        const running = def
          ? def.run({
              from: { element: fromEl, route: toInfo(from) },
              to: { element: toEl, route: toInfo(next) },
              trigger: trigger.current,
              shared,
            })
          : crossfade({ from: { element: fromEl }, to: { element: toEl } })
        if (DEV) syncWaapiSpeed()
        await running
      } catch (error) {
        console.error('[modulato] transition failed', error)
      }
      commit()
    })()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nextKey])

  // Intercept same-origin <a> clicks — plain anchors just work.
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return
      const anchor = (event.target as Element).closest?.('a')
      if (
        !anchor ||
        anchor.target ||
        anchor.hasAttribute('download') ||
        anchor.hasAttribute('data-native')
      )
        return
      const href = anchor.getAttribute('href')
      if (!href || href.startsWith('#')) return
      const url = new URL(anchor.href, window.location.href)
      if (url.origin !== window.location.origin) return
      event.preventDefault()
      trigger.current = anchor
      void navigate(url.pathname + url.search)
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [navigate])

  // Back/forward with scroll restoration.
  useEffect(() => {
    window.history.scrollRestoration = 'manual'
    const onPopState = (event: PopStateEvent) => {
      // A query/hash-only change on the SAME page (e.g. an overlay's ?param
      // pushed by useSearchParam) must not re-resolve or remount the page —
      // useSearchParam readers pick it up via their own popstate listener.
      if (window.location.pathname === stateRef.current.current.path) return
      const scrollY = (event.state?.__modulatoScroll as number | undefined) ?? 0
      void navigate(window.location.pathname + window.location.search, {
        pop: true,
        scrollY,
      })
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [navigate])

  const api = useMemo<RouterApi>(
    () => ({ state, phase, navigate, registerEl }),
    [state, phase, navigate, registerEl],
  )

  return (
    <RouterContext.Provider value={api}>
      <EnhancersContext.Provider value={enhancers ?? NO_ENHANCERS}>
        <App />
      </EnhancersContext.Provider>
    </RouterContext.Provider>
  )
}
