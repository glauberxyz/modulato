import { resolveTokens } from 'modulato'
import { useMotion } from '@modulato/gsap'
import { useRef, type ReactNode } from 'react'
import site from '../motion'
import './track.scss'

/**
 * A run of blocks laid end to end and pulled sideways while the section holds
 * the fold.
 *
 * The reader keeps scrolling down; the page stops and the rail moves instead.
 * It earns its place here rather than being a trick: these two makers are a
 * pair — Ives and the Levys, one after the other — and set as ordinary
 * movements they read as two more entries in a column. Side by side they read
 * as a sequence you travel along.
 *
 * The scroll DISTANCE is derived from the rail's overhang rather than set as a
 * number, so the pin lasts exactly as long as there is rail to move and the
 * two can never disagree — a fixed distance would leave the rail arriving
 * early on a wide screen and still moving on a narrow one. `invalidateOnRefresh`
 * re-measures it on resize.
 */
export function Track({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLElement>(null)

  useMotion(({ gsap }) => {
    const section = ref.current
    const rail = section?.firstElementChild as HTMLElement | null
    if (!section || !rail) return

    const { track } = resolveTokens(site)
    // Two ways this stays still. Reduced motion (or the pin switched off in
    // the tokens), and a screen too narrow for two panels abreast — where the
    // stylesheet has already turned the rail into a column.
    //
    // That second one ASKS THE STYLESHEET rather than repeating its
    // breakpoint. One definition of where the rail is horizontal, and it lives
    // with the layout; this effect re-runs on a breakpoint change, so it gets
    // to reconsider exactly when the answer can have changed. Without it the
    // pin was still being installed over a stacked column — harmless only by
    // accident, because a column's overhang is zero and the pin came out
    // zero-length, spacer and all.
    const horizontal = getComputedStyle(rail).flexDirection === 'row'
    if (!track.scrub || !horizontal) {
      section.dataset.static = 'true'
      return
    }
    section.dataset.static = 'false'

    const overhang = () => Math.max(0, rail.scrollWidth - window.innerWidth)
    gsap.to(rail, {
      x: () => -overhang(),
      ease: 'none',
      scrollTrigger: {
        trigger: section,
        start: 'top top',
        end: () => `+=${overhang() * track.length}`,
        pin: true,
        scrub: track.scrub,
        invalidateOnRefresh: true,
      },
    })
  })

  return (
    <section className="track" ref={ref} aria-label="A sequence read sideways">
      <div className="track__rail">{children}</div>
    </section>
  )
}
