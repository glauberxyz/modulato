import { transition, resolveTokens } from 'modulato'
import tokens from './home__about.motion'

/**
 * Home ↔ About: a full-screen horizontal slide — the outgoing page pushes
 * left while the incoming one arrives from the right (mirrored on the way
 * back thanks to `symmetric`). Numbers live in ./home__about.motion.ts.
 */
export default transition({
  symmetric: true,
  async run({ from, to }) {
    const { duration, ease } = resolveTokens(tokens).slide
    // Reversed pairs run the same choreography; direction follows the pair.
    const towardAbout = to.route.id === 'about'
    const sign = towardAbout ? -1 : 1
    const options: KeyframeAnimationOptions = { duration, easing: ease, fill: 'forwards' }
    await Promise.all([
      from.element.animate(
        [{ transform: 'translateX(0)' }, { transform: `translateX(${sign * 100}%)` }],
        options,
      ).finished,
      to.element.animate(
        [{ transform: `translateX(${sign * -100}%)` }, { transform: 'translateX(0)' }],
        options,
      ).finished,
    ]).catch(() => {})
  },
})
