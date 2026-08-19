import type { Chapter, Figure } from '../../lib/content'
import { ChapterView } from '../../lib/Chapter'
import tokens from './motion'

export default function Angles({
  chapter,
  next,
  figures,
}: {
  chapter: Chapter
  next: Chapter
  figures: Figure[]
}) {
  return <ChapterView chapter={chapter} next={next} figures={figures} tokens={tokens} />
}
