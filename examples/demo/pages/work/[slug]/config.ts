import type { LoadArgs } from 'modulato'

export function load({ params, content }: LoadArgs) {
  return { project: content.projects.find((p) => p.slug === params.slug) ?? null }
}

export function meta({ props }: LoadArgs & { props: ReturnType<typeof load> }) {
  const { project } = props
  return {
    title: project ? `${project.title} — Modulato Demo` : 'Not found — Modulato Demo',
    description: project?.description,
    // Per-page OG tags (SSR'd, so shared links preview correctly).
    meta: project
      ? [
          { property: 'og:title', content: project.title },
          { property: 'og:image', content: project.image },
        ]
      : [],
    // Per-page script: JSON-LD structured data for crawlers.
    script: project
      ? [
          {
            type: 'application/ld+json',
            children: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'CreativeWork',
              name: project.title,
              image: project.image,
              description: project.description,
            }),
          },
        ]
      : [],
  }
}
