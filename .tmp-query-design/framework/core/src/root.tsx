import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
} from 'react'
import { RouterContext, toInfo, type RouterApi } from './context'
import { checkDuplicateSharedIds, DEV } from './dev'
import type { EnhancerDef } from './enhance'
import { collectSharedPairs } from './flip'
import { runPrepare } from './settle'
import { syncWaapiSpeed } from './motion'
import { EnhancersContext } from './page'
import { resolveEntry } from './resolve'
import { notifySearchChange, openQuery } from './search'
import {
  crossfade,
  prepareOutgoing,
  resolveTransition,
  type TransitionsManifest,
} from './transitions'
import type { ContentSource, NavPhase, RouteDef, RouterState } from './types'

interface ModulatoRootProps {
  routes: RouteDef[]
  App: ComponentType
  initial: RouterState
  transitions?: TransitionsManifest
  enhancers?: EnhancerDef[]
  content?: ContentSource
}

const NO_ENHANCERS: EnhancerDef[] = []

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
    async (
      path: string,
      opts: { pop?: boolean; scrollY?: number; restoreScroll?: boolean } = {},
    ) => {
      // Resolved against the full href, not just the origin, so a relative
      // target means what it says — `navigate('?preset=riso')` is a query
      // change on THIS page, where against the origin it silently resolved to
      // `/`. With `query` on RouteInfo, that form is the obvious one to reach
      // for, so it has to be the one that works.
      const url = new URL(path, window.location.href)
      const pathname = url.pathname
      if (pathname === stateRef.current.current.path && !opts.pop) {
        // Same page, different query (or hash): a SHALLOW write — no
        // re-resolve, no remount, exactly what `setSearchParam` does, routed
        // through the same store so every reader updates on the same frame.
        //
        // Before this the guard just returned, so `<a href="?preset=riso">` ON
        // /darkroom was a dead link: the URL was never written and nothing
        // could observe it. Invisible while the query was only reachable
        // through `useSearchParam` — the writer people used was the setter —
        // and immediately visible once `useRoute().query` exists.
        const href = url.pathname + url.search + url.hash
        const { pathname: p, search, hash } = window.location
        if (href !== p + search + hash) {
          window.history.pushState({ ...window.history.state }, '', href)
          notifySearchChange()
        }
        return
      }

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
      // Where the incoming page lands: explicit target (popstate) →
      // remembered position → top.
      //
      // `restore: false` means the page opens at the top FULL STOP — Back and
      // Forward included. The declaration is about the page, not about how
      // you arrived at it, and a page whose opening is choreographed (a title
      // that flies into place, a hero that plays) cannot honour a scroll
      // position without the choreography arriving somewhere nobody can see.
      // Say nothing and Back/Forward restore as they always have.
      //
      // One navigation can override it — `navigate(path, { restoreScroll:
      // true })` — which is how a detail view returns the reader to the exact
      // place in the list it was opened from.
      const config = entry.scroll === false ? undefined : entry.scroll
      const wants = opts.restoreScroll ?? config?.restore
      const remembered = wants ? scrollMemory.get(pathname) : undefined
      targetScroll.current = wants === false ? 0 : (opts.scrollY ?? remembered ?? 0)
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
      // The window is now at the incoming page's scroll. Let motion layers
      // establish scroll-driven layout (pins, scrubbed transforms) BEFORE the
      // shared pairs are measured — their triggers otherwise live in passive
      // effects, which have not run yet, so anything they position would be
      // measured where it will never sit. See settle.ts.
      runPrepare(toEl)
      shared = collectSharedPairs(fromEl, toEl, trigger.current)
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

  // Open the query's hydration gate (search.ts). Until the first commit
  // lands, `query` answers {} — which is exactly what the server rendered, so
  // the hydrating render cannot disagree with the HTML. A LAYOUT effect, so the
  // real URL is in place before the hydrated tree paints, and unconditional, so
  // a page that only reads `usePage().route.query` (never a query hook, so
  // never a subscriber) still gets it.
  useIsomorphicLayoutEffect(() => {
    openQuery()
  }, [])

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

  // The reader's actual position, as of the last scroll EVENT. A native
  // history-traversal restore moves window.scrollY before popstate fires,
  // but its scroll event only dispatches on the next rendering frame — so
  // at popstate time this still holds the pre-traversal position.
  const trueScroll = useRef(0)
  useEffect(() => {
    trueScroll.current = window.scrollY
    const onScroll = () => {
      trueScroll.current = window.scrollY
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Back/forward with scroll restoration.
  useEffect(() => {
    window.history.scrollRestoration = 'manual'
    const onPopState = (event: PopStateEvent) => {
      // A query/hash-only change on the SAME page (e.g. an overlay's ?param
      // pushed by useSearchParam) must not re-resolve or remount the page —
      // useSearchParam readers pick it up via their own popstate listener.
      //
      // "The same page" is the one the URL is on, which DURING A TRANSITION is
      // the pending entry, not the current one: the address bar was pushed to
      // the destination when the navigation started, while `current` is still
      // the page being animated away. Compared against `current`, a traversal
      // back to it looked like a query-only change and was dropped — the URL
      // became the old path while the app went on committing the new one, and
      // the two disagreed until the next navigation. Easy to hit on a slow
      // connection, or with a deliberately long transition.
      const showing = stateRef.current.next?.path ?? stateRef.current.current.path
      if (window.location.pathname === showing) return
      // A browser that natively restored the DESTINATION's scroll has just
      // moved the viewport while the OUTGOING page is still on screen — the
      // page visibly snaps to wherever the other page was left. Undone here,
      // in the same task, before it can paint — and before scroll memory
      // records the corrupted position as the outgoing page's own.
      if (window.scrollY !== trueScroll.current)
        window.scrollTo(0, trueScroll.current)
      const scrollY = (event.state?.__modulatoScroll as number | undefined) ?? 0
      // A traversal that arrives mid-transition CANCELS the one in flight and
      // starts its own, rather than queueing behind it: the reader has asked
      // for a different destination than the one being animated to, and
      // finishing that first would show them a page they have already left.
      // Nothing new is needed for it — `navigate` takes a fresh token, and the
      // transition effect's cleanup marks the running one cancelled as soon as
      // the pending entry changes.
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
