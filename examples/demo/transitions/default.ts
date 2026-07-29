import { transition, resolveTokens } from 'modulato'
import tokens from '../motion'

/**
 * The house fallback: an ink bleed. Any pair without a bespoke transition
 * still gets an authored move rather than the framework's crossfade.
 */
export default transition({
  async run({ from, to }) {
    const { bleed } = resolveTokens(tokens)
    const options: KeyframeAnimationOptions = {
      duration: bleed.duration,
      easing: bleed.ease,
      fill: 'forwards',
    }
    await Promise.all([
      from.element.animate([{ opacity: 1 }, { opacity: 0, filter: 'blur(6px)' }], options).finished,
      to.element.animate(
        [
          { opacity: 0, clipPath: 'inset(0 0 100% 0)' },
          { opacity: 1, clipPath: 'inset(0 0 0% 0)' },
        ],
        options,
      ).finished,
    ]).catch(() => {})
  },
})
