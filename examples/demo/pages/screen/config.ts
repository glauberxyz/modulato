import type { LoadArgs } from 'modulato'
import type { Content } from '../../lib/content'

export function load({ content }: LoadArgs) {
  const c = content as unknown as Content
  return {
    chapter: c.chapters.find((x) => x.slug === 'screen')!,
    figures: c.figures,
  }
}

export function meta({ props }: LoadArgs & { props: ReturnType<typeof load> }) {
  return {
    title: `${props.chapter.numeral}. ${props.chapter.title} — Halftone`,
    description: props.chapter.abstract,
  }
}

// A chapter always opens at its title. `restore` is scroll memory for LINK
// navigations — it would drop you back mid-chapter where you last left off,
// which loses the opening and gives the word flight nothing to land on.
// Coming back from a plate inspector DOES keep your place: that control pops
// history rather than following its href (lib/PlateView.tsx), and the
// framework restores position on Back/Forward regardless of this flag.
export const scroll = { restore: false }
