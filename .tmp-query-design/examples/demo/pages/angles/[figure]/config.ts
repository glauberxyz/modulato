import type { LoadArgs } from 'modulato'
import type { Content } from '../../../lib/content'

export function load({ params, content }: LoadArgs) {
  const c = content as unknown as Content
  return { figure: c.figures.find((f) => f.slug === params.figure)! }
}

export function meta({ props }: LoadArgs & { props: ReturnType<typeof load> }) {
  return {
    title: `${props.figure?.title ?? 'Plate'} — Halftone`,
    description: props.figure?.note,
  }
}
