import { motion } from 'modulato'

/**
 * Site-wide motion tokens — the shell, and every gesture shared by more than
 * one route.
 *
 * A transition's numbers live next to the transition when they are that
 * pair's own. These are not: the word flight is ONE gesture that four
 * chapters perform, and it used to be copied into four identical
 * `transitions/home__*.motion.ts` files — so tuning an act by a few
 * milliseconds meant editing the same number four times, and the overlay
 * showed you a different copy depending on which page you were standing on.
 * The concept is shared, so the tokens are: one group, one row, one edit.
 *
 * `pages/*​/motion.ts` stays per-page so each chapter can tune its own
 * reveals. Since the figure parallax was removed the four are identical in
 * value, and are kept apart only for that per-chapter headroom.
 *
 * A phone/reduced override sits NEXT TO the group it modifies — `tint.phone`,
 * not `phone.tint` — so each group's overrides land in its own icon tabs in
 * the overlay. Both spellings resolve identically; this one reads in place.
 */
export default motion({
  /** The reading bar's catch-up, in units/second toward the true scroll. */
  progress: {
    lerp: 9,
    phone: { lerp: 12 },
    reduced: { lerp: 100 },
  },
  runhead: {
    duration: 0.963,
    ease: 'press',
    reduced: { duration: 0 },
  },

  /**
   * The word flight, in four acts — the pause between them is the point:
   *
   *   1 hold          nothing moves; the clones sit exactly over the words
   *   2 clear + tint  the page fades out (which is what turns the surface
   *                   over) and the title takes the arriving page's ink,
   *                   where it stands
   *   3 gap           breathing room: the words alone, recolored
   *   4 duration      only now do they fly
   *
   * Each direction gets its own acts, because they are not the same move.
   * Going in, a card opens into a chapter and the chapter's lede has to wait
   * for its own title. Coming back, a whole chapter has to be wound up to
   * its head before anything can leave it — so the front of that one is
   * longer.
   */
  flight: {
    // ── index → chapter ────────────────────────────────────────────────
    enter: {
      hold: 201,
      clear: 800,
      gap: 240,
      duration: 1000,
      stagger: 69,
      ease: 'cubic-bezier(0.22, 1, 0.36, 1)',
      phone: { hold: 200, clear: 380, gap: 180, duration: 850, stagger: 120 },
      reduced: { hold: 0, clear: 0, gap: 0, duration: 0, stagger: 0 },
      tint: {
        duration: 725,
        ease: 'cubic-bezier(0.22, 1, 0.36, 1)',
        phone: { duration: 300 },
        reduced: { duration: 0 },
      },
      // The index abstract's exit — a different text from the chapter lede,
      // so it leaves line by line rather than morphing. Goes out in act 2.
      abstract: {
        y: -13,
        duration: 0.5,
        stagger: 0.163,
        ease: 'press',
        reduced: { y: 0, duration: 0, stagger: 0 },
      },
      // The chapter's lede is held back until its title has arrived — it
      // reads as an answer to the title, so it must not precede it. `hold`
      // counts from the LAST word landing, so one value holds correctly for
      // a three-word chapter and a five-word one; negative brings it early.
      lede: {
        hold: -180,
        y: 16,
        duration: 760,
        stagger: 0,
        ease: 'cubic-bezier(0.22, 1, 0.36, 1)',
        phone: { hold: -140, duration: 600, stagger: 0 },
        reduced: { hold: 0, y: 0, duration: 0, stagger: 0 },
      },
      // Only when the words to fly are off-screen: winding the index to the
      // entry first, whichever way is shorter, so the flight has a visible
      // start. `seat` is where they come to rest, as a fraction of the
      // viewport. Going in this is usually a no-op — you clicked an entry you
      // could see — but a trackpad swipe Forward is not a click, and the
      // index may be sitting at its top with the entry well below the fold.
      rewind: {
        duration: 940,
        ease: 'cubic-bezier(0.22, 1, 0.36, 1)',
        seat: 0.658,
        phone: { duration: 480 },
        reduced: { duration: 0 },
      },
    },

    // ── chapter → index ────────────────────────────────────────────────
    back: {
      // Longer at the front than `enter`: the rewind almost always runs on
      // the way back (you read the chapter, so you scrolled it), and the
      // title has to arrive at the top and be SEEN there before it leaves.
      hold: 320,
      clear: 800,
      gap: 300,
      duration: 1000,
      stagger: 69,
      ease: 'cubic-bezier(0.22, 1, 0.36, 1)',
      phone: { hold: 240, clear: 380, gap: 200, duration: 850, stagger: 120 },
      reduced: { hold: 0, clear: 0, gap: 0, duration: 0, stagger: 0 },
      tint: {
        duration: 420,
        ease: 'cubic-bezier(0.22, 1, 0.36, 1)',
        phone: { duration: 320 },
        reduced: { duration: 0 },
      },
      rewind: {
        duration: 940,
        ease: 'cubic-bezier(0.22, 1, 0.36, 1)',
        seat: 0.658,
        phone: { duration: 480 },
        reduced: { duration: 0 },
      },
      // The index fills in behind the title once it has landed — the mirror
      // of `enter.lede`. Without it the index arrives complete and the title
      // flies across a page that is already full. Staggered down the page.
      contents: {
        hold: -710,
        y: 10,
        duration: 850,
        stagger: 85,
        ease: 'cubic-bezier(0.87, 0, 0.13, 1)',
        phone: { hold: -180, duration: 560, stagger: 40 },
        reduced: { hold: 0, y: 0, duration: 0, stagger: 0 },
      },
    },
  },

  /**
   * The chapter's body, on arrival. Movements already on screen when a
   * chapter lands have no scrolling left to trigger them, so they are played
   * outright — `hold` is how long they wait first.
   *
   * The page only becomes active once the whole arrival has resolved, so
   * this is a beat ON TOP of a chapter that has already delivered its title
   * and lede. Raise it to let the head sit alone before the prose arrives.
   *
   * SECONDS, not milliseconds: these are GSAP reveals, like `abstract`
   * above and unlike the flight's acts. Shared rather than per-chapter
   * because it is one gesture all four perform — the reveal's own shape
   * (distance, stagger, trigger line) is identical in all four
   * `pages/<chapter>/motion.ts` too, now that the parallax that used to
   * distinguish them is gone.
   */
  body: {
    hold: 0,
    reduced: { hold: 0 },
  },

  /**
   * A chapter's opening on a COLD landing — one stagger over its head, the
   * title as a whole rather than word by word. Arriving from the index flies
   * the title instead, so this never runs on that path.
   *
   * SECONDS (GSAP). Shared rather than per-chapter: all four open the same
   * way, and this replaced a `title` group that was byte-identical in every
   * `pages/<chapter>/motion.ts`.
   */
  opening: {
    y: 24,
    duration: 0.8,
    stagger: 0.12,
    ease: 'press',
    reduced: { y: 0, duration: 0, stagger: 0 },
  },

  /**
   * The next-chapter card arriving: one stagger down it — label, title,
   * abstract — as it rises past `start` (a line down the viewport). SECONDS.
   * Fires once; the card is the last thing on the page, so there is no
   * scrolling back past it and re-triggering to worry about.
   */
  handoff: {
    y: 26,
    duration: 0.9,
    stagger: 0.12,
    ease: 'press',
    start: 0.9,
    phone: { y: 16, duration: 0.7, stagger: 0.09 },
    reduced: { y: 0, duration: 0, stagger: 0 },
  },

  /**
   * The statement's entrance: its lines rise and fade, one after another, as
   * the block crosses `start` down the viewport. SECONDS (GSAP).
   *
   * `y` is in PIXELS and stays small on purpose. The type here is measured to
   * the column, so it can be 350px tall on a laptop and 620 on a wall — a
   * distance in em would scale with it and turn a lift into a launch.
   */
  statement: {
    y: 44,
    duration: 1,
    stagger: 0.12,
    ease: 'press',
    /** A line down the viewport, as a fraction of its height. */
    start: 0.85,
    phone: { y: 26, duration: 0.8, stagger: 0.09 },
    reduced: { y: 0, duration: 0, stagger: 0 },
  },

  /**
   * The horizontal track: a run of blocks laid end to end, pulled sideways
   * while the section holds the fold.
   *
   * There is no distance here on purpose. The travel is the rail's OVERHANG,
   * measured at refresh — a number would have the rail arriving early on a
   * wide screen and still moving on a narrow one. `length` scales the scroll
   * it takes to cover that overhang: 1 is one pixel down per pixel across,
   * above 1 is slower and more deliberate.
   */
  track: {
    /** Seconds of catch-up behind the scroll. 0 removes the pin entirely and
     *  leaves an ordinary side-scrolling strip — which is what `reduced` wants. */
    scrub: 0.8,
    length: 1.15,
    phone: { scrub: 0.5, length: 1 },
    reduced: { scrub: 0 },
  },

  /**
   * A figure under the pointer — it swells a little, and settles back.
   *
   * CSS owns this one: a `scale` transition on the image itself, which keeps
   * the hover on the compositor and needs no listeners for a gesture that may
   * never happen. So the numbers arrive as custom properties, written on the
   * page root by ChapterView, and the ease is spelled as a cubic-bezier —
   * CSS cannot look up a named GSAP ease, the same reason the transitions
   * below hold theirs that way.
   *
   * Deliberately the standalone `scale` property rather than a transform:
   * this exact <img> is the FLIP target that morphs into the plate
   * inspector, and a transform here would be contending for the channel
   * that move needs.
   */
  figure: {
    /** Rest is 1 — this is where it lands under the pointer. */
    hover: 1.004,
    /** SECONDS: it becomes a CSS transition-duration, not a GSAP tween. */
    duration: 0.7,
    ease: 'cubic-bezier(0.16, 1, 0.3, 1)',
    phone: { hover: 1 },
    reduced: { hover: 1, duration: 0 },
  },

  /** Chapter → plate inspector: the figure FLIPs into the full-bleed plate. */
  flip: {
    duration: 820,
    ease: 'cubic-bezier(0.62, 0.05, 0.01, 0.99)',
    phone: { duration: 600 },
    reduced: { duration: 0 },
  },

  /** The house fallback for any pair without a bespoke transition. */
  bleed: {
    duration: 620,
    // A transition runs on WAAPI, which only speaks CSS — so the config's
    // "press" curve appears here as its cubic-bezier.
    ease: 'cubic-bezier(0.16, 1, 0.3, 1)',
    phone: { duration: 460 },
    reduced: { duration: 0 },
  },
})

/**
 * Hidden search terms, for the Tweak overlay's filter.
 *
 * A group is named for what it IS in the code — `flight.enter.lede` — and
 * whoever comes looking types what it DOES on the page: "main description",
 * "subtitle". No substring of the code name reaches those. The overlay indexes
 * this map and never renders it.
 *
 * Kept honest by hand: rename or repurpose a group and these have to follow.
 * A separate export rather than a key inside `motion({...})` — the token tree
 * is numbers-and-eases and `resolveTokens` hands it straight to animation code.
 */
export const keywords: Record<string, string[]> = {
  'flight.enter.lede': ['main description', 'subtitle', 'chapter intro copy'],
  'flight.enter.abstract': ['index summary', 'card description'],
  'flight.back.contents': ['index list', 'table of contents', 'chapter list'],
  'body': ['chapter prose', 'reveal delay', 'arrival beat'],
  'opening': ['cold load', 'first visit', 'chapter title'],
  'handoff': ['next chapter', 'end card', 'footer card'],
  'statement': ['pull quote', 'big type', 'full screen heading'],
  'track': ['horizontal scroll', 'sideways', 'pinned rail'],
  'figure': ['picture hover', 'image swell', 'zoom'],
  'flip': ['plate inspector', 'image morph', 'open picture'],
  'bleed': ['default transition', 'fallback', 'page fade'],
  'progress': ['reading bar', 'scroll indicator'],
  'runhead': ['header', 'site mark', 'top bar'],
}
