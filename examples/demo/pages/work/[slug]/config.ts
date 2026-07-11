import { projects } from '../../../content/projects'
import type { LoadArgs } from 'modulato'

export function load({ params }: LoadArgs) {
  return { project: projects.find((p) => p.slug === params.slug) ?? null }
}

export function meta({ props }: LoadArgs & { props: ReturnType<typeof load> }) {
  return {
    title: props.project
      ? `${props.project.title} — Modulato Demo`
      : 'Not found — Modulato Demo',
    description: props.project?.description,
  }
}
