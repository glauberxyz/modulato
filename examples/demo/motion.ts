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
 * `pages/*​/motion.ts` stays per-page, where the values genuinely differ —
 * each chapter tunes its own reveals and figure parallax.
 *
 * A phone/reduced override sits NEXT TO the group it modifies — `tint.phone`,
 * not `phone.tint` — so each group's overrides land in its own icon tabs in
 * the overlay. Both spellings resolve identically; this one reads in place.
 */
export default motion({
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
   *   3 gap           breathing room: the words alone, recoloured
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
   * `pages/<chapter>/motion.ts` too; only the figure parallax really differs.
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

  /** Chapter → chapter: a paper feed, sheet out and sheet in. */
  feed: {
    duration: 760,
    skew: 1.6,
    ease: 'cubic-bezier(0.16, 1, 0.3, 1)',
    phone: { duration: 560, skew: 1 },
    reduced: { duration: 0 },
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