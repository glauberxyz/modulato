import { useNavigation, useRoute } from 'modulato'
import './running-head.scss'

const TITLES: Record<string, string> = {
  home: 'Halftone',
  press: 'I · The Binary Press',
  screen: 'II · The Screen',
  angles: 'III · Four Screens, One Sheet',
  gpu: 'IV · The Press on the GPU',
  darkroom: 'Darkroom',
  styles: 'Type & Colour',
}

/**
 * The running head — a magazine's page furniture. It never unmounts, so it
 * can cross-fade its label the instant navigation STARTS (nav.to), while
 * the outgoing page is still on screen.
 */
export function RunningHead() {
  const route = useRoute()
  const nav = useNavigation()
  const id = (nav.to ?? route).id
  const base = id.split('/')[0]
  const dark = base === 'home' || base === 'darkroom'

  return (
    <header className={`runhead ${dark ? 'runhead--dark' : ''}`} data-lenis-prevent="">
      <a className="runhead__mark" href="/">
        Halftone
      </a>
      <span className="runhead__title" key={base}>
        {TITLES[base] ?? base}
      </span>
      <a className="runhead__end" href="/darkroom">
        Darkroom
      </a>
    </header>
  )
}
