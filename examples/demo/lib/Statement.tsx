import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react'
import './statement.scss'

/** useLayoutEffect on the client, useEffect on the server — the fit has to
 *  happen before paint, but React warns if the layout hook runs during SSR. */
const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

/**
 * Type set to the largest size that still fits its column — measured, not
 * guessed.
 *
 * A `vw` size (or a clamp of one) is a guess with the text's own widths left
 * out of it: the same number is too small for "How" and too wide for a longer
 * heading, and it drifts as soon as the face or the tracking changes. This
 * binary-searches the font size against the real rendered line boxes, so the
 * longest line lands on the column edge at ANY width, including a phone.
 *
 * Height is a ceiling rather than a target. Fitting to both would mean a short
 * viewport quietly deciding the type size; this way width is what the size
 * answers to, and height only ever prevents an overflow.
 */
export function FluidHeading({ text, className = '' }: { text: string; className?: string }) {
  const ref = useRef<HTMLHeadingElement>(null)

  useIsomorphicLayoutEffect(() => {
    const el = ref.current
    if (!el) return undefined

    const measure = (size: number) => {
      el.style.fontSize = `${size}px`
      const range = document.createRange()
      range.selectNodeContents(el)
      const rects = Array.from(range.getClientRects())
      return {
        lines: rects.length,
        widest: rects.length ? Math.max(...rects.map((r) => r.width)) : 0,
        height: el.scrollHeight,
      }
    }

    const fit = () => {
      // The HEADING's own content box, not the parent's `clientWidth` — that
      // includes the parent's padding, so the target comes out wider than the
      // space the lines actually have.
      const width = el.clientWidth
      const ceiling = window.innerHeight * 0.72
      if (!width) return

      // Filling the width is NOT the same as being as large as possible, and
      // conflating them is the trap here. Wrapping guarantees no line ever
      // exceeds its container, so "widest <= width" is true at every size and
      // constrains nothing; searching on it just maximises the size until the
      // height stops it, and where the type lands across the column is then
      // luck. Measured, that luck ran out by 68px at one width and 181 at
      // another.
      //
      // Width against size is a sawtooth: the longest line grows as the type
      // does, then collapses each time a word falls to a new line. The peaks —
      // the best fills — sit just below each of those breaks. So this asks, for
      // each plausible line count, how big the type can be while still wrapping
      // to that many lines, and keeps whichever answer covers the most column.
      const candidates: Array<{ size: number; widest: number }> = []
      for (let lines = 1; lines <= 6; lines += 1) {
        let lo = 8
        let hi = 900
        for (let i = 0; i < 14; i += 1) {
          const mid = (lo + hi) / 2
          const m = measure(mid)
          if (m.lines <= lines && m.widest <= width && m.height <= ceiling) lo = mid
          else hi = mid
        }
        candidates.push({ size: lo, widest: measure(lo).widest })
      }

      // Several line counts usually reach the edge — one line always can, by
      // simply being small enough. So filling is the FILTER and size is the
      // choice: take every arrangement that lands flush, then the largest of
      // them. Ranking on fill alone quietly preferred a single small line to a
      // stack of big ones, both flush and one of them not what "big" means.
      // If nothing reaches the edge, fall back to whatever covers most.
      const flush = candidates.filter((c) => c.widest >= width - 1)
      const best = flush.length
        ? flush.reduce((a, b) => (b.size > a.size ? b : a))
        : candidates.reduce((a, b) => (b.widest > a.widest ? b : a))
      el.style.fontSize = `${best.size}px`
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
      {text}
    </h2>
  )
}

/**
 * A full-screen statement: one heading set as large as its column allows, with
 * its copy centred beneath.
 *
 * Kept apart from the chapter so it can be dropped anywhere — it takes a
 * string and children and knows nothing about movements.
 */
export function Statement({ text, children }: { text: string; children?: ReactNode }) {
  return (
    <section className="statement">
      <FluidHeading text={text} />
      {children && <div className="statement__copy">{children}</div>}
    </section>
  )
}
