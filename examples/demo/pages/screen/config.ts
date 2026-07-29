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

// A chapter always opens at its title — Back and Forward included. Its
// opening is choreographed (the title flies in from the index), and a
// restored scroll position puts that choreography somewhere nobody can see,
// with the router and the transition then fighting over the scroll mid-flight.
// The one exception is closing a plate inspector, which asks for the reader's
// place back explicitly — see lib/PlateView.tsx.
export const scroll = { restore: false }
