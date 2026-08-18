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
    </header>
  )
}
