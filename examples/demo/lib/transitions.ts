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
  /** Winding the outgoing page until the words it has to fly are on screen —
   *  either direction, whichever is shorter. `seat` is where they come to
   *  rest, as a fraction of the viewport height. Skipped when any part of
   *  them is already showing. */
  rewind: { duration: number; ease: string; seat: number }
  ease: string
}

/**
 * Whatever the destination page holds back until the title has landed.
 * `hold` is measured from the LAST word arriving, not from the start, so one
 * number is right for a chapter of three words and one of five; negative
 * brings it in early.
 */
export interface ArrivalTokens {
  hold: number
  y: number
  duration: number
  stagger: number
  ease: string
}

/**
 * The two directions are not the same move, so they carry their own acts.
 * `wordFlight` picks by route — the transitions are `symmetric: true`, which
 * runs one definition both ways, not one set of numbers both ways.
 */
export interface WordFlightTokens {
  /** Index → chapter. */
  enter: FlightActs & {
    /** The index abstract's exit: it does NOT morph into the chapter lede —
     *  different text — so it leaves per line and the lede takes the space. */
    abstract: { y: number; duration: number; stagger: number; ease: string }
    /** The chapter's lede — it answers the title, so it waits for it. */
    lede: ArrivalTokens
  }
  /** Chapter → index. */
  back: FlightActs & {
    /** The index's own furniture — hero, the other entries, the foot. The
     *  mirror of `enter.lede`: without it the index arrives complete and an
     *  oversized title flies across a page that is already full. */
    contents: ArrivalTokens
  }
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
 * Hold something on the ARRIVING page back, and let it in once the title has
 * landed. Hidden synchronously by the caller — before the reveal frame
 * paints — and animated in here.
 */
function arriveAfter(
  els: HTMLElement[],
  t: ArrivalTokens,
  landed: number,
): Promise<void> {
  if (!els.length) return Promise.resolve()
  return Promise.all(
    els.map((el, i) =>
      el
        .animate(
          [
            { opacity: 0, transform: `translateY(${t.y}px)` },
            { opacity: 1, transform: 'translateY(0px)' },
          ],
          {
            duration: t.duration,
            delay: Math.max(0, landed + t.hold + i * t.stagger),
            easing: t.ease,
            fill: 'both',
          },
        )
        .finished.catch(() => {})
        // Hand it back to the stylesheet — the page outlives the transition.
        .then(() => {
          el.style.opacity = ''
        }),
    ),
  ).then(() => {})
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
 *
 * The counter-translate goes on FIRST, which means predicting the clamp
 * rather than reading it back afterwards. Scrolling and then compensating
 * leaves the page displaced by the whole delta in between — briefly, but a
 * frame can land there, and it did: arriving at a chapter the router had
 * restored a scroll position for, the index visibly snapped up 800px before
 * the compensation caught it. There is no order in which "scroll, then fix
 * it" is safe.
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
  // Where the document will ACTUALLY let us land — the ends clamp, and both
  // pages are mounted, so the height is the incoming page's.
  const limit = document.documentElement.scrollHeight - vh
  const applied = Math.max(0, Math.min(before + delta, limit)) - before
  if (!applied) return 0
  el.style.transform = `translateY(${applied}px)`
  window.scrollTo(0, before + applied)
  return applied
}

/**
 * Wind the outgoing page until the words it has to fly are on screen — and
 * no further. Either direction.
 *
 * The framework lifts the outgoing page into an absolute overlay offset by
 * the scroll it was left at, so it appears unmoved while the viewport jumps
 * to where the incoming page lands. Translating that overlay is therefore
 * the honest way to "scroll" a page that is no longer scrollable.
 *
 * Driven by the WORDS, not by the page's own top: this transition is
 * symmetric, and the words sit in different places on each side — a chapter
 * title at its head, an index entry a screen and a half down. Winding to the
 * page's top would be right for one and shove the other further away.
 *
 * It used to wind only BACKWARD, on the reasoning that a word below the fold
 * meant the reader had clicked something they could not see. A trackpad swipe
 * is not a click: swipe Forward into a chapter from an index sitting at its
 * top and the entry to fly is a screen and a half BELOW the fold, so the
 * flight set off from a ghost position the reader never saw. Now it winds
 * whichever way is shorter, clamped at both of the page's own edges so no
 * blank is ever exposed past them.
 */
async function windToWords(
  el: HTMLElement,
  words: SharedPair[],
  t: FlightActs['rewind'],
  base: number,
): Promise<void> {
  const rects = words.map((p) => p.from.getBoundingClientRect())
  const top = Math.min(...rects.map((r) => r.top))
  const bottom = Math.max(...rects.map((r) => r.bottom))
  const vh = window.innerHeight
  // Any part of them showing is enough — this is about the flight having a
  // visible start, not about framing it.
  if (bottom > 0 && top < vh) return
  const page = el.getBoundingClientRect()
  // How far the page may travel before its own top (or bottom) would leave
  // the viewport edge and show blank behind it.
  const down = Math.max(0, -page.top)
  const up = Math.min(0, vh - page.bottom)
  const shift = Math.min(down, Math.max(up, t.seat * vh - top))
  if (Math.abs(shift) < 1) return
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

  // What the arriving page holds back until the title has landed. Going in
  // that is the chapter's lede, which answers the title and must not precede
  // it. Coming back it is the whole index EXCEPT the title being flown to —
  // otherwise the index arrives complete, with four entries, their abstracts
  // and the foot, and an oversized title flies across a page already full.
  //
  // The landing entry's own title is deliberately NOT held: its words are
  // revealed one at a time as their clones land, and a word revealed inside
  // a still-transparent parent would appear faint and then brighten.
  const landingEntry = words[0]?.to.closest<HTMLElement>('.entry') ?? null
  const held: HTMLElement[] = []
  if (t.duration) {
    if (entering) {
      const lede = to.element.querySelector<HTMLElement>('.chapter__lede')
      if (lede) held.push(lede)
    } else {
      held.push(
        ...to.element.querySelectorAll<HTMLElement>(
          '.home__hero, .home__contents, .home__foot',
        ),
        ...[...to.element.querySelectorAll<HTMLElement>('.entry')].filter(
          (e) => e !== landingEntry,
        ),
        ...(landingEntry
          ? landingEntry.querySelectorAll<HTMLElement>('.entry__abstract, .entry__arrow')
          : []),
      )
      // The landing entry stays, so its rule would too — one lone hairline
      // under a title flying over an otherwise empty page.
      if (landingEntry) landingEntry.style.borderBottomColor = 'transparent'
    }
  }
  // Document order, so the stagger reads down the page rather than in the
  // order the selectors happened to run.
  held.sort((a, b) =>
    a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
  )
  // Synchronously, before the reveal frame paints — the same discipline as
  // hiding the words themselves.
  for (const el of held) el.style.opacity = '0'

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

  // Everything from here holds part of the ARRIVING page hidden, so it must
  // hand it back however this ends: a throw between the hiding above and the
  // arrival below would leave the reader on a permanently blank page — the
  // framework logs a failed transition and commits anyway.
  try {
    // Both ends of the flight have to be on screen, or there is nothing to
    // watch. The landing is seated first — instantly, hidden under the outgoing
    // page — and then the outgoing page winds, either way, until the words it
    // has to fly are visible too. Both steps are no-ops when their end is
    // already fine, which is the usual case: you clicked an entry you could see.
    await windToWords(
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

    // Act ⑤: the page the title landed on fills in behind it.
    if (held.length) {
      const landed =
        t.hold + t.tint.duration + t.gap + t.duration + (words.length - 1) * t.stagger
      flights.push(
        arriveAfter(held, entering ? tokens.enter.lede : tokens.back.contents, landed).then(
          () => {
            if (landingEntry) landingEntry.style.borderBottomColor = ''
          },
        ),
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
  } finally {
    for (const el of held) el.style.opacity = ''
    if (landingEntry) landingEntry.style.borderBottomColor = ''
  }
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
