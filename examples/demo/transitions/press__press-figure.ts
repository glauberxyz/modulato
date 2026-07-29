import { transition, resolveTokens, flipShared } from 'modulato'
import tokens from './press__press-figure.motion'

/**
 * Chapter → plate inspector. The figure the reader clicked morphs into the
 * full-bleed plate: same <Shared id>, two genuinely different layouts.
 *
 * flipShared clones the outgoing node, so this only works because the
 * figures are <img> — a cloned <canvas> comes back blank.
 */
export default transition({
  symmetric: true,
  async run({ from, to, shared }) {
    const t = resolveTokens(tokens).flip
    await Promise.all([
      ...shared.map((pair) =>
        flipShared(pair, { duration: t.duration, easing: t.ease }),
      ),
      from.element.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: t.duration * 0.55,
        easing: t.ease,
        fill: 'forwards',
      }).finished,
      to.element.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: t.duration * 0.7,
        delay: t.duration * 0.3,
        easing: t.ease,
        // `both`: a forwards-only fill does nothing during the delay, so
        // the page would show at full opacity and then snap to zero.
        fill: 'both',
      }).finished,
    ]).catch(() => {})
  },
})
