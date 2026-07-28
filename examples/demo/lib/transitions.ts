import type { TransitionRunContext } from 'modulato'

export interface RegistrationTokens {
  duration: number
  spread: number
  ease: string
  dot: number
}

/** The four screen angles, as unit vectors — plates arrive along them. */
const ANGLES = [15, 75, 0, 45].map((deg) => {
  const r = (deg * Math.PI) / 180
  return { x: Math.cos(r), y: Math.sin(r) }
})
const INKS = ['#00a0c6', '#d81e78', '#f5c400', '#231f20']

/**
 * Plate registration. The outgoing page separates into four tinted ghosts
 * that drift apart along the screen angles; the incoming page arrives the
 * same way and lands in register.
 *
 * The ghosts are cheap: four absolutely-positioned overlays tinted with
 * mix-blend-mode, not four rasterisations of the page.
 */
export async function plateRegistration(
  { from, to, trigger }: TransitionRunContext,
  t: RegistrationTokens,
) {
  if (!t.duration) return

  // A dot floods from the exact pixel clicked, in that link's plate ink.
  const plate = (trigger as HTMLElement | null)?.dataset?.plate
  const rect = trigger?.getBoundingClientRect()
  const inkIndex = { c: 0, m: 1, y: 2, k: 3 }[plate ?? 'k'] ?? 3

  const ghosts = ANGLES.map((a, i) => {
    const el = document.createElement('div')
    el.style.cssText = `position:absolute;inset:0;background:${INKS[i]};mix-blend-mode:screen;opacity:0.5;pointer-events:none;`
    from.element.append(el)
    return { el, a }
  })

  const options: KeyframeAnimationOptions = {
    duration: t.duration,
    easing: t.ease,
    fill: 'forwards',
  }

  const flood = document.createElement('div')
  if (rect) {
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    flood.style.cssText =
      `position:fixed;left:${cx}px;top:${cy}px;width:${t.dot}px;height:${t.dot}px;` +
      `margin:${-t.dot / 2}px 0 0 ${-t.dot / 2}px;border-radius:50%;background:${INKS[inkIndex]};` +
      `pointer-events:none;z-index:40;`
    document.body.append(flood)
  }

  const reach = Math.hypot(window.innerWidth, window.innerHeight)

  await Promise.all([
    // Plates separate.
    ...ghosts.map(({ el, a }) =>
      el.animate(
        [
          { transform: 'translate(0,0)' },
          { transform: `translate(${a.x * t.spread}px, ${a.y * -t.spread}px)` },
        ],
        options,
      ).finished,
    ),
    from.element.animate([{ opacity: 1 }, { opacity: 0 }], {
      ...options,
      duration: t.duration * 0.8,
      delay: t.duration * 0.2,
    }).finished,
    // The clicked dot floods, then clears.
    rect
      ? flood.animate(
          [
            { transform: 'scale(1)', opacity: 0.85 },
            { transform: `scale(${(reach * 2.4) / t.dot})`, opacity: 0.85, offset: 0.55 },
            { transform: `scale(${(reach * 2.4) / t.dot})`, opacity: 0 },
          ],
          { ...options, duration: t.duration * 1.1 },
        ).finished
      : Promise.resolve(),
    // The incoming sheet arrives in register.
    to.element.animate(
      [
        { opacity: 0, transform: `translate(0, ${t.spread * 0.6}px)` },
        { opacity: 1, transform: 'translate(0,0)' },
      ],
      { ...options, duration: t.duration * 0.9, delay: t.duration * 0.25 },
    ).finished,
  ]).catch(() => {})

  ghosts.forEach(({ el }) => el.remove())
  flood.remove()
}

export interface FeedTokens {
  duration: number
  skew: number
  ease: string
}

/**
 * Chapter → chapter: a paper feed. The finished sheet pulls up out of the
 * press; the next rolls in from below with a skew that corrects on landing.
 */
export async function paperFeed({ from, to }: TransitionRunContext, t: FeedTokens) {
  if (!t.duration) return
  const options: KeyframeAnimationOptions = {
    duration: t.duration,
    easing: t.ease,
    fill: 'forwards',
  }
  await Promise.all([
    from.element.animate(
      [
        { transform: 'translateY(0) skewY(0deg)', opacity: 1 },
        { transform: `translateY(-14%) skewY(${-t.skew}deg)`, opacity: 0 },
      ],
      options,
    ).finished,
    to.element.animate(
      [
        { transform: `translateY(22%) skewY(${t.skew}deg)`, opacity: 0 },
        { transform: 'translateY(0) skewY(0deg)', opacity: 1 },
      ],
      { ...options, delay: t.duration * 0.12 },
    ).finished,
  ]).catch(() => {})
}
