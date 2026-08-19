import { resolveTokens, useScroll, useTicker } from 'modulato'
import { useRef } from 'react'
import tokens from '../motion'
import './scroll-bar.scss'

/**
 * How far through the reading you are, as a hairline along the bottom edge.
 *
 * Measured against the READING, not the document: a chapter ends with a
 * full-height next-chapter card, and counting that as content would both
 * slow the fill and leave it short at the moment the reader has in fact
 * finished. So the bar completes as the card's top reaches the fold — and
 * because it sits exactly there, wearing the card's own color, the finished
 * bar reads as the card's leading edge, which then rises into it.
 *
 * Lives in the shell, outside <PageOutlet/>, so it survives every page swap:
 * the bar does not reset and re-animate on navigation, it simply re-measures
 * against whatever page is now underneath.
 */
export function ScrollBar() {
  const ref = useRef<HTMLDivElement>(null)
  const target = useRef(0)
  const eased = useRef(0)
  const reading = useRef<boolean | null>(null)

  useScroll(() => {
    target.current = readingProgress()
  })

  // The shared framework ticker — one RAF for the whole site, and in dev it
  // runs on the motion clock, so Tweak's slow-mo reaches the fill too.
  useTicker((_, delta) => {
    const el = ref.current
    if (!el) return
    const { progress } = resolveTokens(tokens)
    eased.current +=
      (target.current - eased.current) * Math.min(1, (delta / 1000) * progress.lerp)
    el.style.setProperty('--fill', String(eased.current))

    // Present only where there is a card to be the leading edge of. Written
    // only on change: this runs every frame, and the route changes under a
    // shell that never re-renders, so there is nothing else to react to.
    const has = !!tail()
    if (has !== reading.current) {
      reading.current = has
      el.dataset.reading = String(has)
    }
  })

  return <div className="scrollbar" ref={ref} aria-hidden="true" />
}

/**
 * The next-chapter card of the page currently being read. Mid-transition both
 * pages are mounted, and the LAST in the DOM is the one arriving.
 */
function tail(): HTMLElement | undefined {
  return [...document.querySelectorAll<HTMLElement>('.next')].pop()
}

function readingProgress(): number {
  const max = document.documentElement.scrollHeight - window.innerHeight
  if (max <= 0) return 0
  const card = tail()
  // Where the reading ends: the scroll position at which the card's top
  // meets the fold. Everything past that is the card itself, which is a
  // handoff rather than content — counting it would make the bar crawl.
  const end = card
    ? Math.max(1, card.getBoundingClientRect().top + window.scrollY - window.innerHeight)
    : max
  return Math.min(1, Math.max(0, window.scrollY / end))
}
