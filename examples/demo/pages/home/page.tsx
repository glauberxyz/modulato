import { useRef } from 'react'
import gsap from 'gsap'
import { SplitText } from 'gsap/SplitText'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { resolveTokens, Shared, useTicker } from 'modulato'
import { useMotion } from '@modulato/gsap'
import type { Chapter } from '../../lib/content'
import { EntryTitle } from '../../lib/EntryTitle'
import { HalftoneImage } from '../../lib/HalftoneCanvas'
import { DEFAULTS, type HalftoneUniforms } from '../../lib/halftone'
import tokens from './motion'

gsap.registerPlugin(SplitText, ScrollTrigger)

interface SmileTokens {
  size: number
  contrast: number
  softness: number
  grain: number
  gainC: number
  gainM: number
  gainY: number
  gainK: number
  paper: string
  inkC: string
  inkM: string
  inkY: string
  inkK: string
}

/** The `smile` token group as the press's uniforms. */
const smileUniforms = (s: SmileTokens): HalftoneUniforms => ({
  ...DEFAULTS,
  size: s.size,
  contrast: s.contrast,
  softness: s.softness,
  grainOverlay: s.grain,
  gains: [s.gainC, s.gainM, s.gainY, s.gainK],
  paper: s.paper,
  inks: [s.inkC, s.inkM, s.inkY, s.inkK],
})

const resolveSmile = () =>
  smileUniforms((resolveTokens(tokens as never) as { smile: SmileTokens }).smile)

export default function Home({ chapters }: { chapters: Chapter[] }) {
  // The smile is the shader's calling card: a 100px canvas running the same
  // halftone the site is about, on the page before a word of it. Its numbers
  // are the `smile` group in ./motion.ts, re-read every frame so a drag in
  // Tweak reaches the shader the frame it happens — the press redraws only
  // when one of them actually moved.
  const smile = useRef<HalftoneUniforms>(resolveSmile())
  useTicker(() => {
    smile.current = resolveSmile()
  })

  // A reading head down the lede: each word takes the ink color and hands
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
          gray in
          <br />
          a printed
          <br />
          photograph.
        </h1>

        <p className="home__lede">
          Look closely at any photograph ever printed on paper — a newspaper, a
          magazine, a book. The grays are not there. What is there is dots:
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
        <p className="home__by">Built with Modulato</p>
        <p className="home__colophon">
          The halftone shader is Paper Design’s HalftoneCmyk, Apache-2.0.
          Historical images are public domain — sources are credited on each
          plate.
        </p>
        <p className="home__colophon">
          Every number on this site is a motion token: editable live in the dev
          overlay, or by an agent over MCP. The type and color it is built from
          are set out in the <a href="/styles">specimen</a>.
        </p>
      </footer>
    </main>
  )
}
