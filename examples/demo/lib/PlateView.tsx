import { Shared } from 'modulato'
import type { Figure } from './content'
import './plate-view.scss'

/**
 * Level 3: one plate, full bleed, with its provenance. The image carries the
 * same <Shared id> as the chapter figure it came from, so the navigation
 * FLIPs one into the other across two genuinely different layouts.
 */
export function PlateView({ figure, chapter }: { figure: Figure; chapter: string }) {
  return (
    <article className="plate" data-page={`${chapter}/${figure.slug}`}>
      <div className="plate__stage">
        <Shared id={`plate:${figure.slug}`}>
          <img src={`/plates/${figure.slug}.jpg`} alt={figure.title} />
        </Shared>
      </div>

      <div className="plate__sheet grid">
        <div className="col-aside plate__meta">
          <span className="label">Plate</span>
          <h1 className="plate__title">{figure.title}</h1>
          <dl className="plate__facts">
            <dt>Year</dt>
            <dd>{figure.year}</dd>
            <dt>Credit</dt>
            <dd>{figure.credit}</dd>
            <dt>Rights</dt>
            <dd>{figure.license}</dd>
          </dl>
          <a
            className="plate__back"
            href={`/${chapter}`}
            onClick={(event) => {
              // Closing a plate should put the reader back at the figure they
              // opened, not at the chapter's title. A fresh link navigation
              // can't do that — the chapter deliberately opens at the top —
              // so pop instead: the framework restores the position it stored
              // on that history entry. Only when this page was pushed in
              // session (`history.state` is null on a cold deep-load, where
              // there is nothing behind us and the href is already right).
              if (!window.history.state) return
              event.preventDefault()
              window.history.back()
            }}
          >
            ← Back to the chapter
          </a>
        </div>
        <div className="col-text">
          <p className="plate__note">{figure.note}</p>
          <p className="plate__zoom caption">
            Zoom in. Every image on this site is itself a halftone or an
            engraving — the subject is the medium.
          </p>
          <a
            className="plate__source"
            href={figure.source}
            target="_blank"
            rel="noreferrer noopener"
            data-native
          >
            Source
          </a>
        </div>
      </div>
    </article>
  )
}
