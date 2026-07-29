import gsap from 'gsap'
import { SplitText } from 'gsap/SplitText'
import type { SharedPair, TransitionRunContext } from 'modulato'

gsap.registerPlugin(SplitText)

/**
 * One direction of the flight, in four acts — the pause between them is the
 * point:
 *
 *   ① hold      — nothing. Every clone sits exactly over the word it replaced.
 *   ② clear+tint— the outgoing page fades out, which is what turns the surface
 *                 over, and the title takes the arriving page's ink IN PLACE.
 *                 Colour is the whole event; nothing moves.
 *   ③ gap       — breathing room. The words sit in their new colour on the
 *                 new surface, alone.
 *   ④ flight    — only now do they travel.
 *
 * Colour and movement used to happen together, which read as one hurried
 * gesture. Separated, each gets to be seen.
 */
export interface FlightActs {
  /** How long one word takes to fly (act ④). */
  duration: number
  /** Gap between consecutive words setting off. Paced to be watchable. */
  stagger: number
  /** Act ②: how long the outgoing page takes to clear — and, because the
   *  incoming page sits UNDER it, how long the new one takes to arrive. */
  clear: number
  /** Act ②, on the flying title only: the words cross-fade from the outgoing
   *  page's ink to the arriving one's, without moving. */
  tint: { duration: number; ease: string }
  /** Act ③: the beat between the colour landing and the flight setting off. */
  gap: number
  /** Act ①: a beat before anything happens at all, with every clone sitting
   *  exactly over the word it replaced. Lets the swap settle first. */
  hold: number
  /** Winding a scrolled page back until the words it has to fly are on
   *  screen. `seat` is where they come to rest, as a fraction of the
   *  viewport height. Only ever runs when they are above the fold. */
  rewind: { duration: number; ease: string; seat: number }
  ease: string
}

/**
 * The two directions are not the same move, so they carry their own acts.
 * `wordFlight` picks by route — the transitions are `symmetric: true`, which
 * runs one definition both ways, not one set of numbers both ways.
 */
export interface WordFlightTokens {
  /** Index → chapter. Two extras only this direction has. */
  enter: FlightActs & {
    /** The index abstract's exit: it does NOT morph into the chapter lede —
     *  different text — so it leaves per line and the lede takes the space. */
    abstract: { y: number; duration: number; stagger: number; ease: string }
    /** The chapter's lede, held back until its title has landed. `hold` is
     *  measured from the LAST word arriving, so one number is right for
     *  chapters of three words and of five; negative brings it in early. */
    lede: { hold: number; y: number; duration: number; ease: string }
  }
  /** Chapter → index. No abstract to send away, no lede to wait for. */
  back: FlightActs
}

/**
 * Send a paragraph away line by line. SplitText is only used to find the
 * line boxes; the animation is ordinary GSAP on the resulting spans.
 */
async function exitByLine(
  el: HTMLElement,
  t: WordFlightTokens['enter']['abstract'],
  delay: number,
): Promise<void> {
  if (!t.duration) {
    el.style.opacity = '0'
    return
  }
  const split = new SplitText(el, { type: 'lines' })
  await gsap.to(split.lines, {
    y: t.y,
    opacity: 0,
    // Seconds — this is the one GSAP animation in here; the rest is WAAPI.
    delay: delay / 1000,
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
  t: FlightActs['rewind'],
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
  { from, to, trigger, shared }: TransitionRunContext,
  tokens: WordFlightTokens,
) {
  // `symmetric: true` runs ONE definition both ways — it does not mean one
  // set of numbers both ways. Going in opens a card into a chapter; coming
  // back has to wind a whole read chapter up to its head first.
  const entering = to.route.id !== 'home'
  const t = entering ? tokens.enter : tokens.back

  const words = shared
    .filter((p) => p.id.startsWith('w:'))
    .sort((a, b) => Number(a.id.split(':')[2]) - Number(b.id.split(':')[2]))

  // The abstract the reader clicked. It is NOT shared — the chapter shows
  // its lede there instead — so it leaves rather than travels. `trigger` is
  // the <a> that started the navigation, which is how we know which one.
  const leaving = entering
    ? ((trigger as HTMLElement | null)?.querySelector<HTMLElement>('.entry__abstract') ??
      from.element.querySelector<HTMLElement>('.entry__abstract'))
    : null

  // The chapter's lede answers its title, so it must not arrive before it.
  // Hidden HERE — synchronously, before the reveal frame paints, the same
  // discipline as hiding the words themselves.
  const lede =
    entering && t.duration
      ? to.element.querySelector<HTMLElement>('.chapter__lede')
      : null
  if (lede) lede.style.opacity = '0'

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

    // Act ②: the ink changes, and nothing else. This runs with the index's
    // own fade, so the word darkens at the same moment the surface under it
    // turns from the index's black to the chapter's paper — one colour event
    // the reader can actually follow, rather than a colour shift smuggled
    // inside a flight.
    clone.animate([{ color: fromStyle.color }, { color: toStyle.color }], {
      duration: t.tint.duration,
      delay: t.hold,
      easing: t.tint.ease,
      fill: 'both',
    })

    // Act ④: the travel. No colour here — it landed an act ago.
    return clone
      .animate(
        [
          {
            top: `${fromRect.top}px`,
            left: `${fromRect.left}px`,
            fontSize: fromStyle.fontSize,
            lineHeight: fromStyle.lineHeight,
            letterSpacing: fromStyle.letterSpacing,
          },
          {
            top: `${toRect.top}px`,
            left: `${toRect.left}px`,
            fontSize: toStyle.fontSize,
            lineHeight: toStyle.lineHeight,
            letterSpacing: toStyle.letterSpacing,
          },
        ],
        {
          duration: t.duration,
          delay: t.hold + t.tint.duration + t.gap + delay,
          easing: t.ease,
          fill: 'both',
        },
      )
      .finished.catch(() => {})
      .then(() => {
        pair.to.style.visibility = ''
        clone.remove()
      })
  }

  const flights = words.map((pair, i) => fly(pair, i * t.stagger))
  // Act ②: the abstract goes out line by line with everything else on the
  // index — before the flight, not under it.
  if (leaving) flights.push(exitByLine(leaving, tokens.enter.abstract, t.hold))

  // Act ⑤, only going in: the lede arrives once the title has. Measured from
  // the LAST word landing, so a five-word chapter waits as long as it needs
  // to and a three-word one does not sit there empty.
  if (lede) {
    const landed =
      t.hold + t.tint.duration + t.gap + t.duration + (words.length - 1) * t.stagger
    const l = tokens.enter.lede
    flights.push(
      lede
        .animate(
          [
            { opacity: 0, transform: `translateY(${l.y}px)` },
            { opacity: 1, transform: 'translateY(0px)' },
          ],
          {
            duration: l.duration,
            delay: Math.max(0, landed + l.hold),
            easing: l.ease,
            fill: 'both',
          },
        )
        .finished.catch(() => {})
        .then(() => {
          // Hand it back to the stylesheet — the page outlives the transition.
          lede.style.opacity = ''
        }),
    )
  }

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
