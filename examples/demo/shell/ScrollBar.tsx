import { resolveTokens, useScroll, useTicker } from 'modulato'
import { useRef } from 'react'
import tokens from '../motion'
import './scroll-bar.scss'

/**
 * How far through the reading you are, as a hairline across the top.
 *
 * Measured against the READING, not the document: a chapter ends with a
 * full-height next-chapter card, and counting that as content would leave
 * the bar short of the end at the moment the reader has in fact finished.
 * So it completes as the card begins to rise into view — the bar filling and
 * the next chapter arriving are the same event.
 *
 * Lives in the shell, outside <PageOutlet/>, so it survives every page swap:
 * the bar does not reset and re-animate on navigation, it simply re-measures
 * against whatever page is now underneath.
 */
export function ScrollBar() {
  const ref = useRef<HTMLDivElement>(null)
  const target = useRef(0)
  const eased = useRef(0)

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
  })

  return <div className="scrollbar" ref={ref} aria-hidden="true" />
}

function readingProgress(): number {
  const max = document.documentElement.scrollHeight - window.innerHeight
  if (max <= 0) return 0
  // The LAST card in the DOM: mid-transition both pages are mounted, and the
  // incoming one is the page the reader is arriving at.
  const tail = [...document.querySelectorAll<HTMLElement>('.next')].pop()
  const end = tail
    ? Math.max(1, tail.getBoundingClientRect().top + window.scrollY - window.innerHeight)
    : max
  return Math.min(1, Math.max(0, window.scrollY / end))
}
