import { createContext, useContext } from 'react'
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

function toInfo(entry: Entry): RouteInfo {
  return { id: entry.routeId, path: entry.path, params: entry.params }
}

/** The committed route (does not change until a transition completes). */
export function useRoute(): RouteInfo {
  return toInfo(useRouter().state.current)
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
  return {
    phase,
    from: state.next ? toInfo(state.current) : null,
    to: state.next ? toInfo(state.next) : null,
  }
}
