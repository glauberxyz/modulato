import gsap from 'gsap'
import { SplitText } from 'gsap/SplitText'
import type { SharedPair, TransitionRunContext } from 'modulato'

gsap.registerPlugin(SplitText)

export interface WordFlightTokens {
  /** How long one word takes to fly. */
  duration: number
  /** Gap between consecutive words setting off. Paced to be watchable. */
  stagger: number
  /** How long the rest of the index takes to clear — and, because the
   *  incoming page sits UNDER it, how long the chapter takes to arrive. */
  clear: number
  /** A beat before anything moves, with every clone sitting exactly over
   *  the word it replaced. Lets the swap settle before the flight reads. */
  hold: number
  /** Winding a scrolled page back until the words it has to fly are on
   *  screen. `seat` is where they come to rest, as a fraction of the
   *  viewport height. Only ever runs when they are above the fold. */
  rewind: { duration: number; ease: string; seat: number }
  ease: string
  /** The index abstract's exit: it does NOT morph into the chapter lede —
   *  different text — so it leaves per line and the lede takes the space. */
  abstract: { y: number; duration: number; stagger: number; ease: string }
}

/**
 * Send a paragraph away line by line. SplitText is only used to find the
 * line boxes; the animation is ordinary GSAP on the resulting spans.
 */
async function exitByLine(
  el: HTMLElement,
  t: WordFlightTokens['abstract'],
): Promise<void> {
  if (!t.duration) {
    el.style.opacity = '0'
    return
  }
  const split = new SplitText(el, { type: 'lines' })
  await gsap.to(split.lines, {
    y: t.y,
    opacity: 0,
    duration: t.duration,
    stagger: t.stagger,
    ease: t.ease,
  })
}

/**
 * Scroll the INCOMING page until the words' destination is on screen.
 *
 * A flight needs somewhere visible to land, and the index is 1.4 screens of
 * hero before its contents: arriving at scroll 0 puts the entry a thousand
 * pixels below the fold, and the words leave the bottom edge and are never
 * seen again. Scroll memory covers the common case — you come back to where
 * you were browsing — but not returning to the index from a chapter you
 * reached some other way, so this is the guarantee.
 *
 * The reader sees nothing move: the outgoing page is an absolute overlay
 * covering the viewport, so it is counter-translated by exactly what the
 * window scrolled. Returns that offset, for the wind-back to build on.
 */
function seatLanding(el: HTMLElement, words: SharedPair[], seat: number): number {
  const rects = words.map((p) => p.to.getBoundingClientRect())
  const top = Math.min(...rects.map((r) => r.top))
  const bottom = Math.max(...rects.map((r) => r.bottom))
  const vh = window.innerHeight
  // Only when the landing is genuinely outside, and only by what it takes to
  // clear the edge — a restored scroll position is where the reader was, and
  // is not ours to tidy up.
  const clear = seat * vh
  const delta = bottom > vh ? bottom - vh + clear : top < 0 ? top - clear : 0
  if (!delta) return 0
  const before = window.scrollY
  window.scrollTo(0, before + delta)
  // What the document ACTUALLY allowed — the ends clamp.
  const applied = window.scrollY - before
  if (applied) el.style.transform = `translateY(${applied}px)`
  return applied
}

/**
 * Wind a scrolled outgoing page back until the words it has to fly are on
 * screen — and no further.
 *
 * The framework lifts the outgoing page into an absolute overlay offset by
 * the scroll it was left at, so it appears unmoved while the viewport jumps
 * to where the incoming page lands. Translating that overlay is therefore
 * the honest way to "scroll" a page that is no longer scrollable.
 *
 * Driven by the WORDS, not by the page's top: this transition is symmetric,
 * so it also runs index → chapter, where the words are an entry a screen and
 * a half down. Winding that page to its own top would shove them further
 * away — the opposite of the point. Two clamps keep it honest: it only ever
 * winds BACKWARD (a word below the fold means the reader clicked something
 * they could not see, which cannot happen), and never past the page's own
 * top, so no blank ever appears above it.
 */
async function windBack(
  el: HTMLElement,
  words: SharedPair[],
  t: WordFlightTokens['rewind'],
  base: number,
): Promise<void> {
  const top = Math.min(...words.map((p) => p.from.getBoundingClientRect().top))
  if (top >= 0) return
  const pageTop = el.getBoundingClientRect().top
  const shift = Math.min(t.seat * window.innerHeight - top, -pageTop)
  if (shift < 1) return
  // Built on `base`, the offset seatLanding already put on this element.
  const to = `translateY(${base + shift}px)`
  if (!t.duration) {
    el.style.transform = to
    return
  }
  await el.animate(
    [{ transform: `translateY(${base}px)` }, { transform: to }],
    { duration: t.duration, easing: t.ease, fill: 'forwards' },
  ).finished.catch(() => {})
}

/**
 * Index → chapter: the words fly.
 *
 * The clicked entry's title is split per word on BOTH pages, and each word
 * carries the same <Shared> id — so the framework hands us matched pairs
 * with both rects already measured in final viewport coordinates.
 *
 * flipShared can't do this: it morphs the box (top/left/width/height), which
 * moves a word without resizing its type. Each pair flies as a fixed clone
 * whose type metrics are animated from the source's to the target's, so it
 * is pixel-identical to the real word at both ends of the flight.
 */
export async function wordFlight(
  { from, trigger, shared }: TransitionRunContext,
  t: WordFlightTokens,
) {
  const words = shared
    .filter((p) => p.id.startsWith('w:'))
    .sort((a, b) => Number(a.id.split(':')[2]) - Number(b.id.split(':')[2]))

  // The abstract the reader clicked. It is NOT shared — the chapter shows
  // its lede there instead — so it leaves rather than travels. `trigger` is
  // the <a> that started the navigation, which is how we know which one.
  const leaving =
    (trigger as HTMLElement | null)?.querySelector<HTMLElement>('.entry__abstract') ??
    from.element.querySelector<HTMLElement>('.entry__abstract')

  if (!t.duration || !words.length) {
    // Reduced motion, or nothing matched: just swap. The OUTGOING page is
    // the one to animate — the incoming sits under it, so fading it up
    // reveals nothing while the old page is still opaque on top.
    await from.element.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: t.duration || 1,
      fill: 'forwards',
    }).finished.catch(() => {})
    return
  }

  // Both ends of the flight have to be on screen, or there is nothing to
  // watch. The landing is seated first — instantly, hidden under the outgoing
  // page — and then the outgoing page winds back until the words it has to
  // fly are visible too. Either step is a no-op when its end is already fine,
  // which is the usual case: you clicked an entry you could see.
  await windBack(
    from.element,
    words,
    t.rewind,
    seatLanding(from.element, words, t.rewind.seat),
  )

  const fly = (pair: SharedPair, delay: number) => {
    // Measured HERE, not taken from the pair: the rects the framework handed
    // us predate the rewind above.
    const fromRect = pair.from.getBoundingClientRect()
    const toRect = pair.to.getBoundingClientRect()
    const fromStyle = getComputedStyle(pair.from)
    const toStyle = getComputedStyle(pair.to)
    const clone = pair.from.cloneNode(true) as HTMLElement

    // The clone must be indistinguishable from the word it replaces at the
    // START and from the word it becomes at the END. So it carries real
    // type metrics on both sides and ANIMATES THEM — a transform scale
    // renders the source size stretched, which lands at a slightly
    // different weight and tracking than the real element and shows as a
    // re-settle the moment the two swap.
    Object.assign(clone.style, {
      position: 'fixed',
      display: 'block',
      margin: '0',
      padding: '0',
      zIndex: '60',
      pointerEvents: 'none',
      whiteSpace: 'nowrap',
      fontFamily: fromStyle.fontFamily,
      fontWeight: fromStyle.fontWeight,
      fontStyle: fromStyle.fontStyle,
      fontSize: fromStyle.fontSize,
      lineHeight: fromStyle.lineHeight,
      letterSpacing: fromStyle.letterSpacing,
      color: fromStyle.color,
      top: `${fromRect.top}px`,
      left: `${fromRect.left}px`,
    })
    document.body.append(clone)
    // Both originals hide synchronously, before this frame paints, so the
    // swap to the clone is invisible.
    pair.from.style.visibility = 'hidden'
    pair.to.style.visibility = 'hidden'

    return clone
      .animate(
        [
          {
            top: `${fromRect.top}px`,
            left: `${fromRect.left}px`,
            fontSize: fromStyle.fontSize,
            lineHeight: fromStyle.lineHeight,
            letterSpacing: fromStyle.letterSpacing,
            color: fromStyle.color,
          },
          {
            top: `${toRect.top}px`,
            left: `${toRect.left}px`,
            fontSize: toStyle.fontSize,
            lineHeight: toStyle.lineHeight,
            letterSpacing: toStyle.letterSpacing,
            color: toStyle.color,
          },
        ],
        // The hold: every clone sits exactly over the word it replaced
        // before anything moves. Nothing is visibly happening, which is
        // the point — the swap has to be complete before the flight reads.
        { duration: t.duration, delay: t.hold + delay, easing: t.ease, fill: 'forwards' },
      )
      .finished.catch(() => {})
      .then(() => {
        pair.to.style.visibility = ''
        clone.remove()
      })
  }

  const flights = words.map((pair, i) => fly(pair, i * t.stagger))
  // The index's abstract clears out line by line while the words fly over it.
  if (leaving) flights.push(exitByLine(leaving, t.abstract))

  await Promise.all([
    ...flights,
    // Everything else on the index clears out of the way — and that alone
    // brings the chapter in. The framework stacks the outgoing page ON TOP
    // of the incoming one, so this single fade is a true dissolve: the
    // sheet underneath is already opaque and arrives as the index leaves.
    //
    // Fading the incoming page up as well would be a SECOND fade over the
    // first, and two translucent layers always let the backdrop through —
    // which is exactly what a delayed `fill: 'forwards'` did here: it left
    // the page at full opacity through its delay, then snapped it to zero
    // the instant the delay ended, flashing the surface behind it.
    from.element.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: t.clear,
      delay: t.hold,
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
      // `both`, not `forwards`: a delayed forwards-only animation has no
      // effect during its delay, so the sheet would sit finished-looking
      // and then snap back to its start the moment the delay elapsed.
      { ...options, delay: t.duration * 0.12, fill: 'both' },
    ).finished,
  ]).catch(() => {})
}
