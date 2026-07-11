import type { CSSProperties } from 'react'
import { useNavigation, useRoute } from 'modulato'

const ITEMS = [
  { href: '/', label: 'Home', id: 'home' },
  { href: '/work', label: 'Work', id: 'work' },
  { href: '/about', label: 'About', id: 'about' },
]

/**
 * Persistent shell component. The active indicator SLIDES between items the
 * moment a navigation starts (`nav.to` is set before the transition commits).
 */
export function Menu() {
  const route = useRoute()
  const nav = useNavigation()
  const activeId = (nav.to ?? route).id
  const activeIndex = Math.max(
    ITEMS.findIndex((item) => activeId === item.id || activeId.startsWith(`${item.id}/`)),
    0,
  )

  return (
    <nav className="menu">
      <ul className="menu__list" style={{ '--active-index': activeIndex } as CSSProperties}>
        {ITEMS.map((item, index) => (
          <li
            key={item.id}
            className={`menu__item${index === activeIndex ? ' menu__item--active' : ''}`}
          >
            <a href={item.href}>{item.label}</a>
          </li>
        ))}
        <li className="menu__indicator" aria-hidden="true" />
      </ul>
    </nav>
  )
}
