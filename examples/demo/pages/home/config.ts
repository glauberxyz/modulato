import type { LoadArgs } from 'modulato'
import type { Content } from '../../lib/content'

export function load({ content }: LoadArgs) {
  return { chapters: (content as unknown as Content).chapters }
}

export function meta() {
  return {
    title: 'Halftone — how a printed photograph is made of dots',
    description:
      'A mini-site about the halftone process: where it came from, how the four screens work, and how it becomes a fragment shader. Built with Modulato.',
  }
}
