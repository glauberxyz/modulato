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
/**
 * Where the rail is laid out side by side. MIRRORS the query in track.scss —
 * change both together.
 *
 * It is a query rather than one of the config's breakpoints on purpose. The
 * pin used to be gated on `useMotion` re-running, which only happens when a
 * NAMED breakpoint changes, so the stacking point was pinned to the config's
 * 1279 whether or not the layout wanted it there. `gsap.matchMedia()` owns
 * its own boundary: it builds the pin on entering the query and tears it down
 * on leaving, so the module is free to stack wherever it actually needs to.
 */
const HORIZONTAL = '(min-width: 1024px)'

export function Track({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLElement>(null)

  useMotion(({ gsap }) => {
    const section = ref.current
    const rail = section?.firstElementChild as HTMLElement | null
    if (!section || !rail) return undefined

    const { track } = resolveTokens(site)
    // Reduced motion, or the pin switched off in the tokens: the rail becomes
    // an ordinary side-scrolling strip. Still reachable, just not driven.
    section.dataset.static = 'true'
    if (!track.scrub) return undefined

    const mm = gsap.matchMedia()
    mm.add(HORIZONTAL, () => {
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
      // Runs when the query stops matching: GSAP reverts what was made inside,
      // and the rail goes back to being a column.
      return () => {
        section.dataset.static = 'true'
      }
    })
    return () => mm.revert()
  })

  return (
    <section className="track" ref={ref} aria-label="A sequence read sideways">
      <div className="track__rail">{children}</div>
    </section>
  )
}
