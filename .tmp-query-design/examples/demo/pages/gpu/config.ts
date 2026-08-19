import type { LoadArgs } from 'modulato'
import { nextChapter, type Content } from '../../lib/content'

export function load({ content }: LoadArgs) {
  const c = content as unknown as Content
  return {
    chapter: c.chapters.find((x) => x.slug === 'gpu')!,
    next: nextChapter(c.chapters, 'gpu'),
    figures: c.figures,
  }
}

export function meta({ props }: LoadArgs & { props: ReturnType<typeof load> }) {
  return {
    title: `${props.chapter.numeral}. ${props.chapter.title} — Halftone`,
    description: props.chapter.abstract,
  }
}

// No `scroll` declaration, and that is the considered answer rather than an
// omission — it is the only setting that serves all three ways in.
//
//   link from the index     the top. The title flies into place, so the head
//                           has to be on screen. Omitting `restore` already
//                           starts every LINK navigation at the top.
//   Back from a plate       the reader's place. The router wrote their
//                           position onto this chapter's history entry when
//                           they clicked into the plate, and a traversal
//                           hands it back as the navigation's own target.
//   Forward from the index  the top, because that entry never recorded one.
//
// `restore: false` looked right and was not. It means "the top, Back and
// Forward included", which threw away the position the history entry was
// already holding — so returning from a plate landed at the head, and the
// FLIP flew the picture to a target thousands of pixels off screen.
//
// This carries the whole return path now — a plate has no back link of its
// own, so browser Back IS how a reader comes home from one. Setting
// `restore: false` here would silently strand them at the chapter's head.
