import { resolveTokens } from 'modulato'
import { useMotion } from '@modulato/gsap'
import { EntryTitle } from './EntryTitle'
import site from '../motion'
import type { Chapter } from './content'
import './next-chapter.scss'

/**
 * The tail of every chapter: one card for the chapter that follows, on the
 * index's dark surface rather than the chapter's paper.
 *
 * It carries the index's own `.entry` classes deliberately. The word flight
 * finds its words by <Shared> id and the departing abstract by
 * `.entry__abstract`, so wearing the same clothes as an index entry means
 * chapter → chapter needs no transition code of its own: it IS the
 * index → chapter move, started from a different page.
 *
 * The dark panel is what makes the surface turn read as one gesture — by the
 * time the flight begins, the reader is already looking at the next
 * chapter's color, and the outgoing page's fade dissolves it into the
 * arriving paper.
 */
export function NextChapter({ chapter }: { chapter: Chapter }) {
  // The card sets its own type as it rises. Safe to leave to the trigger
  // rather than holding it like the chapter body: the card is the LAST thing
  // on the page, so on arrival it is always far below the fold and its start
  // line cannot already be crossed at build time.
  useMotion(({ q, gsap }) => {
    const { handoff } = resolveTokens(site)
    const card = q<HTMLElement>('.next')[0]
    if (!card || !handoff.duration) return
    gsap.from(card.querySelectorAll('.next__label, .entry__title, .entry__abstract'), {
      y: handoff.y,
      opacity: 0,
      duration: handoff.duration,
      stagger: handoff.stagger,
      ease: handoff.ease,
      scrollTrigger: { trigger: card, start: `top ${handoff.start * 100}%`, once: true },
    })
  })

  return (
    <aside className="next is-dark" aria-label="Next chapter">
      <a className="entry next__entry" href={`/${chapter.slug}`} data-plate={chapter.plate}>
        <span className="label next__label">Next</span>
        <EntryTitle chapter={chapter} />
        <span className="entry__abstract">{chapter.abstract}</span>
      </a>
    </aside>
  )
}
