import { useRef } from 'react'
import gsap from 'gsap'
import { SplitText } from 'gsap/SplitText'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { resolveTokens, Shared } from 'modulato'
import { useMotion } from '@modulato/gsap'
import type { Chapter } from '../../lib/content'
import { EntryTitle } from '../../lib/EntryTitle'
import { HalftoneImage } from '../../lib/HalftoneCanvas'
import { DEFAULTS, type HalftoneUniforms } from '../../lib/halftone'
import tokens from './motion'

gsap.registerPlugin(SplitText, ScrollTrigger)

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

  // A reading head down the lede: each word takes the ink colour and hands
  // it back, so the highlight travels rather than accumulating. Scrubbed, so
  // the scroll position IS the playhead — scroll back up and it runs in
  // reverse. Numbers in ./motion.ts under `read`.
  useMotion(({ element, q, gsap }) => {
    const t = resolveTokens(tokens as never) as {
      read: { start: number; end: number; scrub: number; stagger: number; rise: number; fall: number }
    }
    const lede = q<HTMLElement>('.home__lede')[0]
    if (!lede || !t.read.rise) return undefined

    const split = new SplitText(lede, { type: 'words' })
    // Both ends read off the DOM rather than hardcoded, so the sweep follows
    // the palette: `rest` is whatever the lede already is, `lit` is the
    // surface's own ink — near-white here, and correct on a light page too.
    const rest = getComputedStyle(split.words[0]).color
    const lit = getComputedStyle(element).getPropertyValue('--ink').trim() || rest

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: lede,
        start: `top ${t.read.start * 100}%`,
        end: `bottom ${t.read.end * 100}%`,
        scrub: t.read.scrub,
      },
    })
    split.words.forEach((word, i) => {
      const at = i * t.read.stagger
      tl.to(word, { color: lit, duration: t.read.rise, ease: 'none' }, at)
      tl.to(word, { color: rest, duration: t.read.fall, ease: 'none' }, at + t.read.rise)
    })

    // The context reverts the timeline and its trigger; the split is ours.
    return () => split.revert()
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
          There is no
          <br />
          grey in
          <br />
          a printed
          <br />
          photograph.
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
            <EntryTitle chapter={c} />
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
