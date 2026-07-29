import { useNavigation, useRoute } from 'modulato'
import './running-head.scss'

/**
 * Page furniture: it never unmounts, so it survives every navigation. The
 * label is deliberately fixed — the chapter name is the page's own job now
 * that titles fly into place.
 */
export function RunningHead() {
  const route = useRoute()
  const nav = useNavigation()
  const id = (nav.to ?? route).id.split('/')[0]

  return (
    <header className="runhead" data-lenis-prevent="">
      <a className="runhead__mark" href="/">
        Halftone. A demo website by Modulato
      </a>
      {id === 'darkroom' ? (
        <a className="runhead__end" href="/">
          Index
        </a>
      ) : (
        <a className="runhead__end" href="/darkroom">
          Darkroom
        </a>
      )}
    </header>
  )
}
