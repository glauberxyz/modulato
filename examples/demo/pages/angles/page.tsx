import type { Chapter, Figure } from '../../lib/content'
import { ChapterView } from '../../lib/Chapter'
import tokens from './motion'

export default function Angles({ chapter, figures }: { chapter: Chapter; figures: Figure[] }) {
  return <ChapterView chapter={chapter} figures={figures} tokens={tokens} />
}
