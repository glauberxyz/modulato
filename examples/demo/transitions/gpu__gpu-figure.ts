import { transition, resolveTokens, flipShared } from 'modulato'
import tokens from '../motion'
import { trackSeat } from '../lib/Track'

/**
 * Chapter → plate inspector. The figure the reader clicked morphs into the
 * full-bleed plate: same <Shared id>, two genuinely different layouts.
 *
 * flipShared clones the outgoing node, so this only works because the
 * figures are <img> — a cloned <canvas> comes back blank.
 *
 * A target inside the horizontal track needs its rect corrected before it can
 * be flown to. That rail is pinned and translated by ScrollTrigger, and on the
 * way back the chapter has not been made active yet — its triggers are
 * disabled through the transition — so the rail is still at x=0 and the
 * section is not pinned. The collector measures a position the panel will
 * never occupy: the first one merely looks wrong, the second is a whole
 * viewport out.
 *
 * `trackSeat` answers where it WILL be, from the same geometry that drives the
 * rail. Correcting the rect rather than skipping the pair is what keeps the
 * morph: the picture flies to the place the rail is about to put it, and the
 * refresh that lands on `active` snaps the rail to exactly that.
 *
 * The correction is keyed to the destination, not the direction, so it costs
 * nothing on the way in — there `to` is the plate stage, ordinary layout,
 * and `trackSeat` returns null.
 */
export default transition({
  symmetric: true,
  async run({ from, to, shared }) {
    const t = resolveTokens(tokens).flip
    await Promise.all([
      ...shared.map((pair) => {
        const seat = trackSeat(pair.to)
        const r = pair.toRect
        const aimed = seat
          ? { ...pair, toRect: new DOMRect(r.left + seat.dx, r.top + seat.dy, r.width, r.height) }
          : pair
        return flipShared(aimed, { duration: t.duration, easing: t.ease })
      }),
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
