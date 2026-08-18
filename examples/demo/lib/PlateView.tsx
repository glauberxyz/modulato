import { Shared } from 'modulato'
import type { Figure } from './content'
import './plate-view.scss'

/**
 * Level 3: one plate, full bleed, with its provenance. The image carries the
 * same <Shared id> as the chapter figure it came from, so the navigation
 * FLIPs one into the other across two genuinely different layouts.
 *
 * Set as one centered column rather than on the grid — the same shape the
 * index uses. There is a single thing on this page and nothing to place it
 * against, so a 12-column split was dividing a column that had no second
 * half to give.
 *
 * No way back to the chapter, by design: browser Back returns the reader to
 * the exact figure they opened (see the scroll note in each chapter's
 * config.ts), and the running head carries the site's own navigation.
 */
export function PlateView({ figure, chapter }: { figure: Figure; chapter: string }) {
  return (
    <article className="plate" data-page={`${chapter}/${figure.slug}`}>
      <div className="plate__stage">
        <Shared id={`plate:${figure.slug}`}>
          <img src={`/plates/${figure.slug}.jpg`} alt={figure.title} />
        </Shared>
      </div>

      <div className="plate__sheet">
        <h1 className="plate__title">{figure.title}</h1>
        <p className="plate__note">{figure.note}</p>
        {/* Year, credit and rights as one run rather than a definition list.
            Centered, a two-column dt/dd grid has no edge to align to and the
            labels outweigh what they label — and `credit` already carries its
            own `·` separators, so the whole line reads as one provenance
            statement in the site's figref idiom. */}
        <p className="plate__facts figref">
          {figure.year} · {figure.credit} · {figure.license}
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
    </article>
  )
}
