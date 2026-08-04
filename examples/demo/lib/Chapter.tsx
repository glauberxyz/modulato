import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { Fragment, useEffect, useRef } from 'react'
import { resolveTokens, Shared, usePage } from 'modulato'
import { useMotion } from '@modulato/gsap'
import site from '../motion'
import { NextChapter } from './NextChapter'
import { Track } from './Track'
import type { Chapter, Figure, Movement } from './content'

// ScrollTrigger is the app's to register. @modulato/gsap detects it and
// bridges Lenis into it automatically, so scrub stays in sync with the
// smoothed scroll position rather than the native one.
gsap.registerPlugin(ScrollTrigger)
import { AnglesDiagram } from './diagrams/AnglesDiagram'
import { SeparationDiagram } from './diagrams/SeparationDiagram'
import { NeighbourDiagram } from './diagrams/NeighbourDiagram'
import { InkDiagram } from './diagrams/InkDiagram'
import { RulingDiagram } from './diagrams/RulingDiagram'
import './chapter.scss'

const DIAGRAMS: Record<string, () => React.JSX.Element> = {
  angles: AnglesDiagram,
  separation: SeparationDiagram,
  neighbours: NeighbourDiagram,
  ink: InkDiagram,
  ruling: RulingDiagram,
}

/**
 * A movement's heading, always over two lines.
 *
 * These sit in a narrow column beside their prose, and left to the line
 * breaker they came out as one, two, three or four lines depending on the
 * viewport and on how long the words happened to be — so the column changed
 * shape as you resized, and two headings of similar length could look like
 * different sizes of thing. Two lines is the shape that reads, so it is
 * decided here rather than discovered at layout time.
 *
 * The break goes at the word boundary that leaves the halves closest in
 * length. That is what `text-wrap: balance` optimises for, but balance cannot
 * be told HOW MANY lines to balance across — it takes the count the width
 * gives it. Choosing the split makes the count the constant and lets the
 * width vary, which is the way round we want.
 */
/**
 * Consecutive movements sharing a `track` id, gathered into one run. Anything
 * without a track is its own run of ordinary sections, so the page is a list
 * of runs rather than a list of movements — which is what lets a group of
 * them be wrapped without the wrapper leaking around their neighbours.
 */
function runs(movements: Movement[]): Array<{ track?: string; items: Array<[Movement, number]> }> {
  const out: Array<{ track?: string; items: Array<[Movement, number]> }> = []
  movements.forEach((m, i) => {
    const last = out[out.length - 1]
    // A run continues only while the id is the SAME and unbroken — two tracks
    // that happen to share a name with a section between them stay separate.
    if (last && last.track === m.track) last.items.push([m, i])
    else out.push({ track: m.track, items: [[m, i]] })
  })
  return out
}

function MovementHeading({ text, className = 'movement__h col-side' }: { text: string; className?: string }) {
  const words = text.split(' ')
  let at = 0
  let closest = Infinity
  for (let i = 1; i < words.length; i++) {
    const gap = Math.abs(
      words.slice(0, i).join(' ').length - words.slice(i).join(' ').length,
    )
    if (gap < closest) {
      closest = gap
      at = i
    }
  }
  return (
    <h2 className={className}>
      {at ? (
        <>
          {words.slice(0, at).join(' ')}
          <br />
          {words.slice(at).join(' ')}
        </>
      ) : (
        text
      )}
    </h2>
  )
}

/**
 * One chapter, rendered from content. Movements alternate across the 12-col
 * grid — prose in the text measure, figures wide, asides in the margin — so
 * the rhythm comes from column placement rather than from type sizes.
 */
export function ChapterView({
  chapter,
  next,
  figures,
  tokens,
}: {
  chapter: Chapter
  /** The chapter this one hands off to — the sequence wraps, so the last
      chapter points back at the first. */
  next: Chapter
  figures: Figure[]
  /** The page's own motion.ts module — kept per-chapter so each one tunes
      its own reveals in the overlay. */
  tokens: unknown
}) {
  const byslug = new Map(figures.map((f) => [f.slug, f]))
  let figN = 0
  const reveals = useRef<Array<{ section: HTMLElement; tween: gsap.core.Tween }>>([])
  // `element` is null on the first render — the page root registers itself
  // after mount — so it has to be a dependency below: the reveals do not
  // exist until useMotion has run against a real element.
  const { phase, element } = usePage()
  // Read inside useMotion's callback, which is not re-run on phase changes.
  const phaseRef = useRef(phase)
  phaseRef.current = phase

  // Scroll choreography: every movement rises as it enters. gsap.context() is
  // page-scoped and reverts on unmount, so nothing leaks into the next
  // chapter mid-transition.
  useMotion(({ element: root, q, gsap }) => {
    const t = resolveTokens(tokens as never) as {
      reveal: { y: number; duration: number; stagger: number; ease: string; start: number }
    }

    // The figure hover is a CSS `scale` transition (see chapter.scss) — it
    // needs no JS to RUN, only its numbers. Written on the page root, so they
    // leave with the page, and rewritten whenever this effect re-runs: that
    // is what carries a breakpoint change, a reduced-motion change or a
    // Tweak edit through to a gesture CSS is holding.
    const { figure } = resolveTokens(site)
    root.style.setProperty('--fig-hover', String(figure.hover))
    root.style.setProperty('--fig-hover-duration', `${figure.duration}s`)
    root.style.setProperty('--fig-hover-ease', figure.ease)

    // Each movement rises as it enters. `start` is a line down the viewport,
    // which is right for everything you scroll to — and wrong for whatever is
    // ALREADY on screen when the chapter arrives, since there is no scrolling
    // left to cross it. Where that line falls relative to the first movement
    // is an accident of how tall the chapter's head is: /press clears it by
    // 76px and reveals on arrival, /angles misses it by 10 and sat blank
    // until the reader nudged the page. So anything in view on arrival is
    // played outright.
    reveals.current = q<HTMLElement>('.movement').map((section) => {
      // `.movement__label` and not a bare `.label`: a diagram's controls
      // carry labels of their own ("Tightest beat", "Texture fetches / pixel")
      // that belong to the instrument, not to the reveal.
      const targets = section.querySelectorAll(
        '.movement__p, .movement__h, .movement__label, figure, .diagram',
      )
      const tween = gsap.from(targets, {
        y: t.reveal.y,
        opacity: 0,
        duration: t.reveal.duration,
        stagger: t.reveal.stagger,
        ease: t.reveal.ease,
        scrollTrigger: { trigger: section, start: `top ${t.reveal.start * 100}%` },
      })
      return { section, tween }
    })

    // A page that is still ARRIVING reveals nothing yet. A movement sitting
    // above the trigger line fires the instant its trigger is built — and
    // that is here, at mount, mid-transition — so the prose faded up behind
    // the flight on exactly the chapters whose head is short enough to put
    // it there: /press starts at 715 against a 791 line, while /angles at
    // 800 missed the line and only looked correct by accident. Held at their
    // start; the arrival effect below owns when they play.
    if (phaseRef.current !== 'active') {
      for (const { tween } of reveals.current) tween.progress(0).pause()
    }

    return () => {
      reveals.current = []
    }
  })

  // Once the chapter has actually arrived — the transition committed, the
  // scroll settled, ScrollTrigger refreshed — play whatever is already on
  // screen. Measured HERE rather than when the tweens were built, because at
  // build time the page is mid-transition and its position is not final.
  //
  // `body.hold` is the beat before that: the page becomes active only after
  // the whole flight has resolved, so this waits on top of an arrival that
  // has already delivered the title and its lede. Site-wide, not per chapter
  // — see the group's note in /motion.ts.
  useEffect(() => {
    if (!element || phase !== 'active') return undefined
    const { body } = resolveTokens(site)
    const onScreen = reveals.current.filter(
      ({ section }) => section.getBoundingClientRect().top < window.innerHeight,
    )
    // Every one of them comes off its trigger, not just the ones waiting on
    // it. A movement that happens to sit ABOVE the trigger line on arrival
    // was already fired by ScrollTrigger's refresh — which runs earlier in
    // this same commit, so nothing has painted yet — and leaving those alone
    // made `hold` apply to some of the body and not the rest, purely by where
    // a chapter's head height dropped the first section. Rewound to their
    // start state here, so one beat governs all of it.
    //
    // `kill(false, true)` drops the gate without reverting the elements or
    // taking the tween with it; ScrollTrigger would otherwise re-pause an
    // animation whose start line it thinks is uncrossed.
    for (const { tween } of onScreen) {
      tween.scrollTrigger?.kill(false, true)
      tween.progress(0).pause()
    }
    const play = () => {
      for (const { tween } of onScreen) tween.play()
    }
    if (!body.hold) {
      play()
      return undefined
    }
    // Outside useMotion's context, so it needs its own teardown — a chapter
    // left before the beat elapses must not play into a reverted page.
    const waiting = gsap.delayedCall(body.hold, play)
    return () => {
      waiting.kill()
    }
  }, [element, phase])

  /** Whatever prose a movement carries, in the right half of the field. */
  const copyOf = (m: Movement) =>
    m.body.length ? (
      <div className="col-main">
        {m.body.map((p, j) => (
          <p className="movement__p" key={j}>
            {p}
          </p>
        ))}
      </div>
    ) : null

  /** A movement as a section down the page. */
  const movement = (m: Movement, i: number) => {
    const key = `${chapter.slug}-${i}`
    const copy = copyOf(m)

    if (m.kind === 'figure') {
      const fig = byslug.get(m.figure ?? '')
      if (!fig) return null
      figN += 1
      const n = figN
      return (
        <section className="grid movement movement--figure" key={key}>
          <figure className="col-field">
            {/* FLIP target: this exact element morphs into the plate
                inspector at /<chapter>/<figure>. */}
            <a href={`/${chapter.slug}/${fig.slug}`} className="movement__figlink">
              <Shared id={`plate:${fig.slug}`}>
                <img src={`/plates/${fig.slug}.jpg`} alt={fig.title} loading="lazy" />
              </Shared>
            </a>
            {/* One line. Number, date and title used to stack, which gave a
                two-line block the weight of a caption proper — this is a
                label on a picture, not a paragraph. */}
            <figcaption className="movement__cap figref">
              Abb. {n} · {fig.year}. {fig.title}
            </figcaption>
          </figure>
          {copy}
        </section>
      )
    }

    if (m.kind === 'aside') {
      return (
        <section className="grid movement movement--aside" key={key}>
          {/* The rule runs the full field while the aside itself keeps to the
              right half — the width of the line is what marks the
              interruption, so it has to be wider than the text. */}
          <div className="col-field movement__band" />
          <aside className="col-main chapter__aside">
            {/* The global `.label` carries the type; `movement__label` adds
                only its rule, and is the reveal's hook. */}
            {m.heading && <h3 className="label movement__label">{m.heading}</h3>}
            {m.body.map((p, j) => (
              <p className="movement__p" key={j}>
                {p}
              </p>
            ))}
            {m.note && <p className="movement__note">{m.note}</p>}
          </aside>
        </section>
      )
    }

    if (m.kind === 'diagram') {
      const D = DIAGRAMS[m.diagram ?? '']
      return (
        <section className="grid movement movement--diagram" key={key}>
          {/* A diagram is a picture, so it takes the field and the heading
              answers it below — the same shape as a figure. */}
          <div className="col-field movement__diagram">{D ? <D /> : null}</div>
          {m.heading && <MovementHeading text={m.heading} />}
          {copy}
        </section>
      )
    }

    return (
      <section className="grid movement movement--prose" key={key}>
        {m.heading && <MovementHeading text={m.heading} />}
        {copy}
      </section>
    )
  }

  /**
   * The same movement as a panel on a horizontal rail.
   *
   * Deliberately NOT `.movement`: the per-movement scroll reveal finds its
   * targets by that class, and a reveal keyed to a vertical trigger line is
   * meaningless for a block that arrives sideways — all four would fire at
   * once the moment the section pinned. Travelling into view IS the reveal
   * here.
   */
  const panel = (m: Movement, i: number) => {
    const key = `${chapter.slug}-${i}`

    if (m.kind === 'figure') {
      const fig = byslug.get(m.figure ?? '')
      if (!fig) return null
      figN += 1
      const n = figN
      return (
        <figure className="track__panel track__panel--figure" key={key}>
          <a href={`/${chapter.slug}/${fig.slug}`} className="movement__figlink">
            <Shared id={`plate:${fig.slug}`}>
              <img src={`/plates/${fig.slug}.jpg`} alt={fig.title} loading="lazy" />
            </Shared>
          </a>
          <figcaption className="movement__cap figref">
            Abb. {n} · {fig.year}. {fig.title}
          </figcaption>
        </figure>
      )
    }

    return (
      <div className="track__panel track__panel--prose" key={key}>
        {m.heading && <MovementHeading text={m.heading} className="movement__h" />}
        {m.body.map((p, j) => (
          <p className="movement__p" key={j}>
            {p}
          </p>
        ))}
      </div>
    )
  }

  return (
    <article className="chapter" data-page={chapter.slug}>
      {/* The landing zone. Each title word carries the SAME <Shared> id as
          its counterpart on the index, so the transition can fly them here
          one by one; the abstract follows to sit under them. */}
      <header className="chapter__head">
        <h1 className="chapter__title">
          {chapter.title.split(' ').map((word, i) => (
            <Shared key={i} id={`w:${chapter.slug}:${i}`}>
              <span className="chapter__word">{word}</span>
            </Shared>
          ))}
        </h1>
        {/* The lede, not the index's abstract — they are different texts,
            so the index's fades out rather than morphing into this one. */}
        <p className="chapter__lede">{chapter.lede}</p>
      </header>

      <div className="chapter__body">
        {runs(chapter.movements).map((run, r) =>
          run.track ? (
            <Track key={run.track}>{run.items.map(([m, i]) => panel(m, i))}</Track>
          ) : (
            // A fragment, not a wrapper: these are the chapter's own sections
            // and inserting an element around them would break the flow they
            // are laid out in.
            <Fragment key={`run-${r}`}>{run.items.map(([m, i]) => movement(m, i))}</Fragment>
          ),
        )}
      </div>

      {/* The apparatus, on its own surface. A white band rather than a rule:
          the sources are not the end of the argument, they are underneath it,
          and a change of paper says that without spending a heading on it.
          Full-bleed, with the list held in the same right half the prose ran
          in, so the reader's column never moves. */}
      <footer className="chapter__foot">
        <div className="grid">
          <div className="col-main">
            <span className="label">Sources</span>
            {/* `role="list"` because the numbers are a CSS counter and
                `list-style: none` drops list semantics in Safari/VoiceOver —
                without it the count is announced to nobody. */}
            <ol className="chapter__sources" role="list">
              {chapter.sources.map((s) => (
                <li key={s.url}>
                  <a href={s.url} target="_blank" rel="noreferrer noopener" data-native>
                    {s.text}
                  </a>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </footer>

      <NextChapter chapter={next} />
    </article>
  )
}
