import { resolveTokens, useNavigation, useRoute, useScroll, useTicker } from 'modulato'
import { useRef } from 'react'
import tokens from '../motion'
import './plate-marker.scss'

const ORDER = ['press', 'screen', 'angles', 'gpu']

/**
 * Four plate registration marks, stacked at the right edge — the shell's
 * proof that it never unmounts. Scroll drives the fill of the active plate;
 * navigation re-registers the stack. Both survive the page swap because
 * this component lives OUTSIDE <PageOutlet/>.
 */
export function PlateMarker() {
  const route = useRoute()
  const nav = useNavigation()
  const id = (nav.to ?? route).id.split('/')[0]
  const active = ORDER.indexOf(id)
  const ref = useRef<HTMLDivElement>(null)
  const progress = useRef(0)
  const eased = useRef(0)

  useScroll((e) => {
    progress.current = e.progress
  })

  // The shared framework ticker — one RAF for the whole site. In dev this
  // now runs on the motion clock, so Tweak's slow-mo reaches it too.
  useTicker((_, delta) => {
    const el = ref.current
    if (!el) return
    const { marker } = resolveTokens(tokens)
    eased.current += (progress.current - eased.current) * Math.min(1, (delta / 1000) * marker.lerp)
    el.style.setProperty('--fill', String(eased.current))
  })

  if (active < 0) return null

  return (
    <div className="plates" ref={ref} aria-hidden="true">
      {ORDER.map((slug, i) => (
        <span
          key={slug}
          className={`plates__dot plates__dot--${slug}`}
          data-state={i === active ? 'active' : i < active ? 'done' : 'todo'}
        />
      ))}
    </div>
  )
}
