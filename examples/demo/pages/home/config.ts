import type { LoadArgs } from 'modulato'
import type { Content } from '../../lib/content'

// `request` is SERVER-ONLY: present on the first paint, undefined when a
// reader arrives here by clicking a link, because `load()` runs in the
// browser then. Hence the guard — `modulato check` errors without one.
//
// A canonical URL is the honest case for it: only the server knows the host
// the reader actually typed. On a client navigation there is no request and
// no canonical link, which costs nothing — a crawler only ever sees the SSR'd
// HTML.
export function load({ content, request }: LoadArgs) {
  const chapters = (content as unknown as Content).chapters
  if (!request) return { chapters, canonical: null }
  const url = new URL(request.url)
  return { chapters, canonical: `${url.origin}${url.pathname}` }
}

// `meta()` reads the SNAPSHOT here, not just `props` — the case every other
// config in this demo happens to avoid, and the one that broke: on hydration
// the snapshot is deliberately empty, so a `meta()` reaching into it threw and
// took `boot()` down with it, leaving a fully SSR'd page blank behind the
// intro cloak. Keep at least one route reading `content` in `meta()`; it is
// the documented way to build a title and nothing else covers it.
export function meta({ props, content }: LoadArgs & { props: ReturnType<typeof load> }) {
  const { chapters } = content as unknown as Content
  return {
    title: 'Halftone — how a printed photograph is made of dots',
    description: `A mini-site about the halftone process, in ${chapters.length} chapters: where it came from, how the four screens work, and how it becomes a fragment shader. Built with Modulato.`,
    link: props.canonical ? [{ rel: 'canonical', href: props.canonical }] : [],
  }
}

// The index is the grid: every chapter and the running head link back here,
// and the word flight has to land on the entry you came from. Without scroll
// memory a link back opens the index at its hero, ~1.4 screens above the
// contents, and the words fly off the bottom edge to an entry nobody can see.
export const scroll = { restore: true }
