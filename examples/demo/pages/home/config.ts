import { projects } from '../../content/projects'

export function load() {
  return { featured: projects }
}

export function meta() {
  return {
    title: 'Modulato Demo — Motion is the message',
    description: 'A three-page site proving Modulato: transitions, persistent elements, SSR.',
  }
}
