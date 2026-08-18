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

/**
 * Where an element inside the rail will SIT once the section is pinned and the
 * rail translated — as an offset from wherever it is measured right now, with
 * neither applied yet.
 *
 * This exists for one reason: a page mounts during its own transition, and a
 * transitioning page's ScrollTriggers are disabled, so the pin has not been
 * built and the rail is still at x=0. Anything measuring a panel at that
 * moment — the shared-element collector, above all — reads a position the
 * panel will never occupy. The second panel is a whole viewport out.
 *
 * The geometry lives HERE, beside the tween it describes, so the two cannot
 * drift: `end` is `overhang * length` and the tween runs `x` to `-overhang`
 * across exactly that, which is all this reimplements.
 *
 *   dy  while pinned the section is held at the top of the viewport, so it
 *       sits lower than its document position by however far the reader has
 *       travelled into the pinned range — and past the end it keeps that
 *       offset, because the pin released there.
 *   dx  the rail's own translation at that progress.
 *
 * Null when there is nothing to correct: not in a track, stacked rather than
 * pinned, or a rail short enough that it never moves.
 */
export function trackSeat(el: Element): { dx: number; dy: number } | null {
  const section = el.closest<HTMLElement>('.track')
  if (!section || section.dataset.static === 'true') return null
  const rail = section.firstElementChild as HTMLElement | null
  if (!rail) return null

  const { track } = resolveTokens(site)
  const overhang = Math.max(0, rail.scrollWidth - window.innerWidth)
  const distance = overhang * track.length
  if (!distance) return null

  const top = section.getBoundingClientRect().top + window.scrollY
  const travelled = Math.min(Math.max(window.scrollY - top, 0), distance)
  return { dx: -overhang * (travelled / distance), dy: travelled }
}

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
