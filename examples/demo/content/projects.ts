export interface Project {
  slug: string
  title: string
  year: number
  color: string
  image: string
  description: string
}

export const projects: Project[] = [
  {
    slug: 'aurora',
    title: 'Aurora',
    year: 2026,
    color: '#e07a5f',
    image: 'https://picsum.photos/seed/aurora/1200/800',
    description:
      'A generative identity system built on drifting light fields. Every export of the mark is a unique frame of a continuous simulation.',
  },
  {
    slug: 'meridian',
    title: 'Meridian',
    year: 2025,
    color: '#3d5a80',
    image: 'https://picsum.photos/seed/meridian/1200/800',
    description:
      'An editorial platform where the layout grid rotates with the reading position, keeping long-form pieces spatially memorable.',
  },
  {
    slug: 'cascade',
    title: 'Cascade',
    year: 2025,
    color: '#81936e',
    image: 'https://picsum.photos/seed/cascade/1200/800',
    description:
      'A launch site for a water-computing startup — scroll velocity feeds a fluid simulation that carries the product story downstream.',
  },
]
