import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { resolveTokens, Shared } from 'modulato'
import { useMotion } from '@modulato/gsap'
import type { Chapter, Figure } from './content'

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
 * One chapter, rendered from content. Movements alternate across the 12-col
 * grid — prose in the text measure, figures wide, asides in the margin — so
 * the rhythm comes from column placement rather than from type sizes.
 */
export function ChapterView({
  chapter,
  figures,
  tokens,
}: {
  chapter: Chapter
  figures: Figure[]
  /** The page's own motion.ts module — kept per-chapter so each one tunes
      its own reveals in the overlay. */
  tokens: unknown
}) {
  const byslug = new Map(figures.map((f) => [f.slug, f]))
  let figN = 0

  // Scroll choreography: every movement rises as it enters, and figures
  // drift against the scroll. gsap.context() is page-scoped and reverts on
  // unmount, so nothing leaks into the next chapter mid-transition.
  useMotion(({ q, gsap }) => {
    const t = resolveTokens(tokens as never) as {
      reveal: { y: number; duration: number; stagger: number; ease: string; start: number }
      figure: { parallax: number; scale: number }
    }

    q<HTMLElement>('.movement').forEach((section) => {
      const targets = section.querySelectorAll('.movement__p, .movement__h, figure, .diagram')
      gsap.from(targets, {
        y: t.reveal.y,
        opacity: 0,
        duration: t.reveal.duration,
        stagger: t.reveal.stagger,
        ease: t.reveal.ease,
        scrollTrigger: { trigger: section, start: `top ${t.reveal.start * 100}%` },
      })
    })

    if (t.figure.parallax) {
      q<HTMLElement>('.movement__figlink img').forEach((img) => {
        gsap.fromTo(
          img,
          { yPercent: -t.figure.parallax / 10 },
          {
            yPercent: t.figure.parallax / 10,
            ease: 'none',
            scrollTrigger: { trigger: img, scrub: true, start: 'top bottom', end: 'bottom top' },
          },
        )
      })
    }
  })

  return (
    <article className="chapter" data-page={chapter.slug}>
      <header className="chapter__head grid">
        <div className="chapter__meta col-full">
          <span className="label">Chapter {chapter.numeral}</span>
          <span className="label">Halftone</span>
        </div>
        <h1 className="chapter__title col-full">{chapter.title}</h1>
        <p className="chapter__lede col-stack-b">{chapter.lede}</p>
      </header>

      <div className="chapter__body">
        {chapter.movements.map((m, i) => {
          const key = `${chapter.slug}-${i}`

          if (m.kind === 'figure') {
            const fig = byslug.get(m.figure ?? '')
            if (!fig) return null
            figN += 1
            const n = figN
            return (
              <section className="grid movement movement--figure" key={key}>
                <figure className={i % 2 ? 'col-stack-b' : 'col-wide'}>
                  {/* FLIP target: this exact element morphs into the plate
                      inspector at /<chapter>/<figure>. */}
                  <a href={`/${chapter.slug}/${fig.slug}`} className="movement__figlink">
                    <Shared id={`plate:${fig.slug}`}>
                      <img src={`/plates/${fig.slug}.jpg`} alt={fig.title} loading="lazy" />
                    </Shared>
                  </a>
                  <figcaption className="movement__cap">
                    <span className="figref">
                      Abb. {n} · {fig.year}
                    </span>
                    <span className="caption">{fig.title}</span>
                  </figcaption>
                </figure>
                <div className={i % 2 ? 'col-aside' : 'col-text'}>
                  {m.body.map((p, j) => (
                    <p className="movement__p" key={j}>
                      {p}
                    </p>
                  ))}
                </div>
              </section>
            )
          }

          if (m.kind === 'aside') {
            return (
              <section className="grid movement movement--aside" key={key}>
                <aside className="col-stack-a chapter__aside">
                  {m.heading && <h3 className="movement__h movement__h--small">{m.heading}</h3>}
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
                <div className="col-full">
                  {m.heading && <h2 className="movement__h">{m.heading}</h2>}
                  {D ? <D /> : null}
                  <div className="movement__diagramcopy">
                    {m.body.map((p, j) => (
                      <p className="movement__p" key={j}>
                        {p}
                      </p>
                    ))}
                  </div>
                </div>
              </section>
            )
          }

          return (
            <section className="grid movement movement--prose" key={key}>
              {m.heading && <h2 className="movement__h col-aside">{m.heading}</h2>}
              <div className="col-text">
                {m.body.map((p, j) => (
                  <p className="movement__p" key={j}>
                    {p}
                  </p>
                ))}
              </div>
            </section>
          )
        })}
      </div>

      <footer className="chapter__foot grid">
        <div className="col-aside">
          <span className="label">Sources</span>
        </div>
        <ol className="col-text chapter__sources">
          {chapter.sources.map((s) => (
            <li key={s.url}>
              <a href={s.url} target="_blank" rel="noreferrer noopener" data-native>
                {s.text}
              </a>
            </li>
          ))}
        </ol>
      </footer>
    </article>
  )
}
