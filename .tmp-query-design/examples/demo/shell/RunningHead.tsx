import { useNavigation, useRoute } from 'modulato'
import './running-head.scss'

/**
 * Page furniture: it never unmounts, so it survives every navigation. The
 * label is deliberately fixed — the chapter name is the page's own job now
 * that titles fly into place.
 *
 * The darkroom is the one page that is not part of the reading. It is a
 * playground reached from the head and left the same way, so there the mark
 * stops naming the site and becomes the way out — and the right-hand link,
 * which pointed home as well, goes with it. Two links to `/` a few hundred
 * pixels apart is not a choice, it is the same choice twice.
 */
export function RunningHead() {
  const route = useRoute()
  const nav = useNavigation()
  const id = (nav.to ?? route).id.split('/')[0]
  const inDarkroom = id === 'darkroom'
  // The shell reads the page's query without knowing anything about the page.
  // `route.query` is live, so picking a preset — a SHALLOW write that never
  // remounts the darkroom, never touches its canvas — relabels the way out on
  // the same frame, and so does Back.
  const preset = route.query.preset

  return (
    <header className="runhead" data-lenis-prevent="">
      <a className="runhead__mark" href="/">
        {inDarkroom ? 'Back to home' : 'Halftone. A demo website by Modulato'}
      </a>
      {!inDarkroom && (
        <a className="runhead__end" href="/darkroom">
          Darkroom
        </a>
      )}
      {inDarkroom && preset && <span className="runhead__end">{preset}</span>}
    </header>
  )
}
