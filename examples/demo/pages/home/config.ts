import type { LoadArgs } from 'modulato'

export function load({ content }: LoadArgs) {
  return { featured: content.projects }
}

export function meta() {
  return {
    title: 'Modulato Demo — Motion is the message',
    description: 'A three-page site proving Modulato: transitions, persistent elements, SSR.',
  }
}
