import { createContext, useContext } from 'react'
import { getQuery, useSearchParams } from './search'
import type { Entry, NavPhase, RouteInfo, RouterState } from './types'

export interface RouterApi {
  state: RouterState
  phase: NavPhase
  /**
   * Go to a route. `restoreScroll` overrides the destination page's own
   * `scroll.restore` for this one navigation, landing at the position it was
   * last left at — how a detail view returns the reader to the exact place in
   * the list it was opened from, even when that list declares it opens at the
   * top.
   */
  navigate: (path: string, opts?: { restoreScroll?: boolean }) => Promise<void>
  registerEl: (key: string, el: HTMLElement | null) => void
}

export const RouterContext = createContext<RouterApi | null>(null)

export function useRouter(): RouterApi {
  const ctx = useContext(RouterContext)
  if (!ctx) throw new Error('[modulato] useRouter must be used inside <ModulatoRoot>')
  return ctx
}

/**
 * The ONE place a RouteInfo is built (root, page scope, intros, hooks).
 *
 * With no `query` argument the property is a LIVE GETTER. That is what every
 * consumer outside React's render wants — a transition, an enhancer,
 * `usePage().route` — because each of those is read at a moment in time and the
 * truthful answer is the URL as it is then, not as it was when the entry
 * resolved. It also keeps the object's IDENTITY tied to the entry, so effects
 * keyed on `route` (enhancers in page.tsx) don't tear down and re-apply every
 * behavior on the page each time an overlay toggles a param.
 *
 * Hooks pass the query React has already validated for this render instead, so
 * a concurrent render cannot tear.
 */
export function routeInfo(
  id: string,
  path: string,
  params: Record<string, string>,
  query?: Readonly<Record<string, string>>,
): RouteInfo {
  if (query) return { id, path, params, query }
  return {
    id,
    path,
    params,
    get query() {
      return getQuery()
    },
  }
}

export function toInfo(
  entry: Entry,
  query?: Readonly<Record<string, string>>,
): RouteInfo {
  return routeInfo(entry.routeId, entry.path, entry.params, query)
}

/**
 * The committed route (`id`/`path`/`params` do not change until a transition
 * completes) plus `query`, which is live: this re-renders on every query
 * change, shallow writes (`setSearchParam`) and Back/Forward included.
 */
export function useRoute(): RouteInfo {
  return toInfo(useRouter().state.current, useSearchParams())
}

/**
 * Live navigation state. `to` is set from the moment a navigation starts
 * rendering the incoming page — use `to ?? useRoute()` to react early.
 */
export function useNavigation(): {
  phase: NavPhase
  from: RouteInfo | null
  to: RouteInfo | null
} {
  const { state, phase } = useRouter()
  const query = useSearchParams()
  return {
    phase,
    from: state.next ? toInfo(state.current, query) : null,
    to: state.next ? toInfo(state.next, query) : null,
  }
}
