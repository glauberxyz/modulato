/** Shapes for the JSON in content/ — see modulato content --json. */

export interface Source {
  text: string
  url: string
}

export interface Movement {
  kind: 'prose' | 'figure' | 'aside' | 'diagram'
  heading?: string
  body: string[]
  /** figure slug, when kind === 'figure' */
  figure?: string
  /** diagram id, when kind === 'diagram' */
  diagram?: string
  note?: string
}

export interface Chapter {
  slug: string
  numeral: string
  title: string
  plate: 'c' | 'm' | 'y' | 'k'
  abstract: string
  lede: string
  movements: Movement[]
  sources: Source[]
}

/**
 * The chapter after this one, wrapping past the last back to the first — the
 * sequence is a loop, so the reader is never handed a dead end.
 */
export function nextChapter(chapters: Chapter[], slug: string): Chapter {
  const i = chapters.findIndex((c) => c.slug === slug)
  return chapters[(i + 1) % chapters.length]
}

export interface Figure {
  slug: string
  title: string
  credit: string
  year: string
  license: string
  source: string
  chapter: string
  note: string
}

export interface Content {
  chapters: Chapter[]
  figures: Figure[]
}
