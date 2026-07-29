import type { LoadArgs } from 'modulato'
import type { Content } from '../../lib/content'

export function load({ content }: LoadArgs) {
  return { chapters: (content as unknown as Content).chapters }
}

export function meta() {
  return {
    title: 'Halftone — how a printed photograph is made of dots',
    description:
      'A mini-site about the halftone process: where it came from, how the four screens work, and how it becomes a fragment shader. Built with Modulato.',
  }
}

// The index is the grid: every chapter and the running head link back here,
// and the word flight has to land on the entry you came from. Without scroll
// memory a link back opens the index at its hero, ~1.4 screens above the
// contents, and the words fly off the bottom edge to an entry nobody can see.
export const scroll = { restore: true }
