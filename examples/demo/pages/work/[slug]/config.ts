import type { LoadArgs } from 'modulato'

export function load({ params, content }: LoadArgs) {
  return { project: content.projects.find((p) => p.slug === params.slug) ?? null }
}

export function meta({ props }: LoadArgs & { props: ReturnType<typeof load> }) {
  return {
    title: props.project
      ? `${props.project.title} — Modulato Demo`
      : 'Not found — Modulato Demo',
    description: props.project?.description,
  }
}
