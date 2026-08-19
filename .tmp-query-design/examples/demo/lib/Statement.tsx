import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react'
import { resolveTokens } from 'modulato'
import { useMotion } from '@modulato/gsap'
import site from '../motion'
import './statement.scss'

/** useLayoutEffect on the client, useEffect on the server — the fit has to
 *  happen before paint, but React warns if the layout hook runs during SSR. */
const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

/**
 * Type set so its longest line lands exactly on the column edge — measured,
 * not guessed.
 *
 * A `vw` size (or a clamp of one) is a guess with the text's own widths left
 * out of it: the same number is too small for "How" and too wide for a longer
 * heading, and it drifts as soon as the face or the tracking changes.
 *
 * The LINE BREAKS ARE THE AUTHOR'S — split the text on newlines and each part
 * is set on its own line, unwrappable. That is a typographic decision, not
 * something to be derived: "How / coarse / is coarse" is three lines because
 * it reads that way, and letting the browser choose put "How coarse" together
 * whenever the column happened to allow it.
 *
 * Given breaks, the fit stops being a search. Each line is `nowrap`, so its
 * width is simply proportional to the size — measure once and scale by the
 * ratio. The longest line fills the column; the others fall where they fall,
 * centered and ragged, which is the shape the block is after.
 *
 * Width is the ONLY constraint, and that is a real trade. Three fixed lines
 * filling a 1376px column want about 950px of height, which a 900px-tall
 * laptop has not got — so a height ceiling would have to shrink the type and
 * stop it reaching the edge, which it did, by 484px at that width. "Always
 * fills the width" and "always inside the fold" cannot both hold for a fixed
 * number of lines on a short screen. Width wins here; the section grows.
 */
export function FluidHeading({ text, className = '' }: { text: string; className?: string }) {
  const ref = useRef<HTMLHeadingElement>(null)

  useIsomorphicLayoutEffect(() => {
    const el = ref.current
    if (!el) return undefined

    // The widest line's TYPE, not its box. Each line is `display: block`, so
    // its box is the column and measuring it reports the column width back at
    // every size — a ratio of exactly 1, and a fit that never moves off its
    // reference. A Range over the line's contents measures the glyphs.
    const range = document.createRange()
    const widest = () => {
      let max = 0
      for (const line of Array.from(el.children)) {
        range.selectNodeContents(line)
        const w = range.getBoundingClientRect().width
        if (w > max) max = w
      }
      return max
    }

    const fit = () => {
      // The HEADING's own content box, not the parent's `clientWidth` — that
      // includes the parent's padding, so the target comes out wider than the
      // space the lines actually have.
      const width = el.clientWidth
      if (!width || !el.children.length) return

      // The lines are given, and each one is `nowrap`, so a line's width is
      // simply proportional to the size — no search. Measure once at a
      // reference size and scale by the ratio.
      const REFERENCE = 100
      el.style.fontSize = `${REFERENCE}px`
      const at100 = widest()
      if (!at100) return
      let size = REFERENCE * (width / at100)

      // Hinting and sub-pixel rounding make that proportion very slightly
      // inexact, so one correction pass off the real measurement lands it.
      el.style.fontSize = `${size}px`
      size *= width / widest()
      el.style.fontSize = `${size}px`
    }

    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(el)
    // Webfonts land after first paint, and the metrics they bring are not the
    // fallback's — without this the fit is correct for a face that is no
    // longer on screen.
    document.fonts?.ready.then(fit).catch(() => {})
    return () => observer.disconnect()
  }, [text])

  return (
    <h2 className={`statement__title ${className}`.trim()} ref={ref}>
      {text.split('\n').map((line, i) => (
        // A span per line rather than <br>, so each one has a box the fit can
        // measure. Newlines in the content string, not markup — the heading is
        // data, and data that carries tags has to be trusted to render.
        <span className="statement__line" key={i}>
          {line}
        </span>
      ))}
    </h2>
  )
}

/**
 * A full-screen statement: one heading set as large as its column allows, with
 * its copy centered beneath.
 *
 * Kept apart from the chapter so it can be dropped anywhere — it takes a
 * string and children and knows nothing about movements.
 */
export function Statement({ text, children }: { text: string; children?: ReactNode }) {
  const section = useRef<HTMLElement>(null)

  // The lines rise and fade, one after another, as the block comes up.
  //
  // Scoped to THIS section by ref rather than by useMotion's page-wide `q`,
  // so a page carrying two statements does not animate both off whichever one
  // scrolled into view first.
  useMotion(({ gsap }) => {
    const el = section.current
    if (!el) return
    const { statement } = resolveTokens(site)
    const lines = el.querySelectorAll('.statement__line')
    if (!statement.duration || !lines.length) return

    gsap.from(lines, {
      y: statement.y,
      opacity: 0,
      duration: statement.duration,
      stagger: statement.stagger,
      ease: statement.ease,
      scrollTrigger: {
        trigger: el,
        start: `top ${statement.start * 100}%`,
        once: true,
      },
    })
  })

  return (
    <section className="statement" ref={section}>
      <FluidHeading text={text} />
      {children && <div className="statement__copy">{children}</div>}
    </section>
  )
}
