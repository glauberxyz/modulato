import { useNavigation, useRoute } from 'modulato'

/**
 * A persistent decorative element that repositions, rescales and recolors per
 * route — the "element that changes state while you navigate" in miniature.
 * It starts moving as soon as navigation begins, in sync with the transition.
 */
export function Marker() {
  const route = useRoute()
  const nav = useNavigation()
  const id = (nav.to ?? route).id
  const state = id === 'home' ? 'home' : id.startsWith('work') ? 'work' : 'about'

  return <div className="marker" data-state={state} aria-hidden="true" />
}
