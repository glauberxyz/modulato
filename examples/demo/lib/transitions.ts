import type { SharedPair, TransitionRunContext } from 'modulato'

export interface WordFlightTokens {
  /** How long one word takes to fly. */
  duration: number
  /** Gap between consecutive words setting off. Paced to be watchable. */
  stagger: number
  /** How long the rest of the index takes to clear. */
  clear: number
  /** When the chapter body fades up, as a fraction of the whole flight. */
  bodyAt: number
  ease: string
}

/**
 * Index → chapter: the words fly.
 *
 * The clicked entry's title is split per word on BOTH pages, and each word
 * carries the same <Shared> id — so the framework hands us matched pairs
 * with both rects already measured in final viewport coordinates.
 *
 * flipShared can't do this: it morphs the box (top/left/width/height), which
 * moves a word without resizing its type. Words need to SCALE, so each pair
 * flies as a fixed-position clone under a transform, with the scale taken
 * from the width ratio of the same string at both sizes.
 */
export async function wordFlight(
  { from, to, shared }: TransitionRunContext,
  t: WordFlightTokens,
) {
  const words = shared
    .filter((p) => p.id.startsWith('w:'))
    .sort((a, b) => Number(a.id.split(':')[2]) - Number(b.id.split(':')[2]))
  const abstract = shared.find((p) => p.id.startsWith('d:'))

  if (!t.duration || (!words.length && !abstract)) {
    // Reduced motion, or nothing matched: just swap.
    await to.element.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: t.duration || 1,
      fill: 'forwards',
    }).finished.catch(() => {})
    return
  }

  const fly = (pair: SharedPair, delay: number) => {
    const clone = pair.from.cloneNode(true) as HTMLElement
    const style = getComputedStyle(pair.from)
    // The clone leaves the page, so it needs its type carried explicitly —
    // the class it keeps is scoped to the index's own stylesheet.
    Object.assign(clone.style, {
      position: 'fixed',
      top: `${pair.fromRect.top}px`,
      left: `${pair.fromRect.left}px`,
      margin: '0',
      zIndex: '60',
      pointerEvents: 'none',
      transformOrigin: 'top left',
      font: style.font,
      letterSpacing: style.letterSpacing,
      lineHeight: style.lineHeight,
      color: style.color,
      whiteSpace: 'nowrap',
    })
    document.body.append(clone)
    // Both originals hide synchronously, before this frame paints: the
    // chapter's own words must never flash at their landing spot.
    pair.from.style.visibility = 'hidden'
    pair.to.style.visibility = 'hidden'

    const scale = pair.fromRect.width ? pair.toRect.width / pair.fromRect.width : 1
    const dx = pair.toRect.left - pair.fromRect.left
    const dy = pair.toRect.top - pair.fromRect.top
    // The word leaves light-on-dark and lands dark-on-paper: without this it
    // would arrive the colour of the page it is landing on and vanish.
    const landing = getComputedStyle(pair.to).color

    return clone
      .animate(
        [
          { transform: 'translate(0px, 0px) scale(1)', color: style.color },
          { transform: `translate(${dx}px, ${dy}px) scale(${scale})`, color: landing },
        ],
        { duration: t.duration, delay, easing: t.ease, fill: 'forwards' },
      )
      .finished.catch(() => {})
      .then(() => {
        pair.to.style.visibility = ''
        clone.remove()
      })
  }

  const flights = words.map((pair, i) => fly(pair, i * t.stagger))
  // The abstract sets off with the last word and lands under it.
  if (abstract) flights.push(fly(abstract, Math.max(0, words.length - 1) * t.stagger))

  const total = t.duration + Math.max(0, words.length - 1) * t.stagger

  await Promise.all([
    ...flights,
    // Everything else on the index clears out of the way.
    from.element.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: t.clear,
      easing: t.ease,
      fill: 'forwards',
    }).finished.catch(() => {}),
    // The sheet arrives under the words while they are still in the air —
    // it has to, or they would land dark on a dark page.
    to.element.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: total * 0.5,
      delay: total * t.bodyAt,
      easing: t.ease,
      fill: 'forwards',
    }).finished.catch(() => {}),
  ])
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
