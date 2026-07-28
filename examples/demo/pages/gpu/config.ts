import type { LoadArgs } from 'modulato'
import type { Content } from '../../lib/content'

export function load({ content }: LoadArgs) {
  const c = content as unknown as Content
  return {
    chapter: c.chapters.find((x) => x.slug === 'gpu')!,
    figures: c.figures,
  }
}

export function meta({ props }: LoadArgs & { props: ReturnType<typeof load> }) {
  return {
    title: `${props.chapter.numeral}. ${props.chapter.title} — Halftone`,
    description: props.chapter.abstract,
  }
}

export const scroll = { restore: true }
