import { Shared } from 'modulato'
import { Arrow } from './Arrow'
import type { Chapter } from './content'

/**
 * A chapter's title as individually addressable words, each one a <Shared>
 * element — which is what lets the word flight carry them from wherever the
 * chapter is listed to its own head.
 *
 * Shared by the index and by every chapter's next-chapter card, so both ends
 * of a flight derive the same ids from the same slug without either side
 * knowing about the other. It reads as an ordinary line of type until you
 * click it.
 */
export function EntryTitle({ chapter }: { chapter: Chapter }) {
  return (
    <span className="entry__title">
      {chapter.title.split(' ').map((word, i) => (
        <Shared key={i} id={`w:${chapter.slug}:${i}`}>
          <span className="entry__word">{word}</span>
        </Shared>
      ))}
      <Arrow className="entry__arrow" />
    </span>
  )
}
