import { EntryTitle } from './EntryTitle'
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
 * chapter's colour, and the outgoing page's fade dissolves it into the
 * arriving paper.
 */
export function NextChapter({ chapter }: { chapter: Chapter }) {
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
