import { createContext, useContext } from 'react'
import type { Entry, NavPhase, RouteInfo, RouterState } from './types'

export interface RouterApi {
  state: RouterState
  phase: NavPhase
  navigate: (path: string) => Promise<void>
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
