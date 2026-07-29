import { useRef } from 'react'
import { Shared } from 'modulato'
import type { Chapter } from '../../lib/content'
import { Arrow } from '../../lib/Arrow'
import { HalftoneImage } from '../../lib/HalftoneCanvas'
import { DEFAULTS, type HalftoneUniforms } from '../../lib/halftone'

/**
 * Every chapter title is split PER WORD, and each word is a <Shared>
 * element — the words are what fly to the top of the chapter page during
 * the transition, so they have to be individually addressable here. It
 * reads as an ordinary line of type until you click it.
 */
function Title({ chapter }: { chapter: Chapter }) {
  return (
    <span className="entry__title">
      {chapter.title.split(' ').map((word, i) => (
        <Shared key={i} id={`w:${chapter.slug}:${i}`}>
          <span className="entry__word">{word}</span>
        </Shared>
      ))}
      <Arrow className="entry__arrow" />
    </span>
  )
}

export default function Home({ chapters }: { chapters: Chapter[] }) {
  // The smile is the shader's calling card: a 100px canvas running the same
  // halftone the site is about, on the page before a word of it.
  const smile = useRef<HalftoneUniforms>({
    ...DEFAULTS,
    // Coarse on purpose: at 100px a fine screen puts the dots under a pixel
    // and the whole thing greys out. ~30 cells reads as dots.
    size: 0.88,
    contrast: 1.5,
    softness: 0.1,
    grainOverlay: 0,
    // Yellow at full gain — it is the only plate doing real work here.
    gains: [-0.17, -0.3, 0, 0],
    paper: '#14110f',
    inks: ['#00a0c6', '#d81e78', '#f5c400', '#14110f'],
  })

  return (
    <main className="home is-dark" data-page="home">
      <section className="home__hero">
        <HalftoneImage
          src="/smile.svg"
          alt="A smiley face, screened"
          uniforms={smile}
          className="home__smile"
        />

        <h1 className="home__claim">
          There is no grey in
          <br />a printed photograph.
        </h1>

        <p className="home__lede">
          Look closely at any photograph ever printed on paper — a newspaper, a
          magazine, a book. The greys are not there. What is there is dots:
          thousands of them, larger where the picture is dark, small enough that
          your eye gives up and averages them into tone.
        </p>

        <p className="home__note">
          This site takes apart the halftone shader running behind these words —
          where the technique came from, and how a rule invented for ruled glass
          in 1894 ended up as four floats in a fragment shader.
        </p>
      </section>

      <nav className="home__index" aria-label="Chapters">
        <span className="label home__contents">Contents</span>
        {chapters.map((c) => (
          <a key={c.slug} className="entry" href={`/${c.slug}`} data-plate={c.plate}>
            <Title chapter={c} />
            <Shared id={`d:${c.slug}`}>
              <span className="entry__abstract">{c.abstract}</span>
            </Shared>
          </a>
        ))}
      </nav>

      <footer className="home__foot">
        <p className="home__by">Built with Modulato. Designed by Glauber</p>
        <p className="home__colophon">
          The halftone shader is Paper Design's HalftoneCmyk, Apache-2.0.
          Historical images are public domain — sources are credited on each
          plate.
        </p>
        <p className="home__colophon">
          Every number on this site is a motion token: editable live in the dev
          overlay, or by an agent over MCP. The type and colour it is built from
          are set out in the <a href="/styles">specimen</a>.
        </p>
      </footer>
    </main>
  )
}
