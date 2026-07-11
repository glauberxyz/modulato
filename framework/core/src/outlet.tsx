import { useRouter } from './context'
import { PageScope, type PagePhase } from './page'

/**
 * Where pages mount. During a transition the outgoing and incoming pages are
 * BOTH rendered — the framework's coexisting-trees guarantee that makes
 * crossfades, slides, and shared-element FLIP possible.
 */
export function PageOutlet() {
  const { state, registerEl } = useRouter()
  const entries = state.next ? [state.current, state.next] : [state.current]
  return (
    <div data-modulato-outlet="" style={{ position: 'relative' }}>
      {entries.map((entry) => {
        // The incoming page mounts HIDDEN — it is revealed by the framework in
        // the same task that starts the transition's animations, so no
        // unstyled frame is ever painted (no flicker).
        const isIncoming = entry.key === state.next?.key
        const phase: PagePhase = isIncoming
          ? 'entering'
          : state.next
            ? 'leaving'
            : 'active'
        return (
          <PageScope
            key={entry.key}
            entry={entry}
            phase={phase}
            hidden={isIncoming}
            registerEl={registerEl}
          />
        )
      })}
    </div>
  )
}
