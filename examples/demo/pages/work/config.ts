import type { LoadArgs } from 'modulato'

export function load({ content }: LoadArgs) {
  return { projects: content.projects }
}

export function meta() {
  return {
    title: 'Work — Modulato Demo',
    description: 'Three dummy projects, one shared-element transition each.',
  }
}
