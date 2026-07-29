import { motion } from 'modulato'

/**
 * The word flight, in four acts — the pause between them is the point.
 *
 *   1 hold          nothing moves; the clones sit exactly over the words
 *   2 clear + tint  the index fades out (which turns the surface over) and
 *                   the clicked title takes the chapter's ink, in place
 *   3 gap           breathing room: the words alone, recoloured, on the new page
 *   4 duration      only now do they fly
 *
 * Colour and travel used to run together and read as one hurried gesture.
 */
export default motion({
  flight: {
    // 1
    hold: 201,
    // 2 — these two run together; `clear` is what reveals the arriving page.
    clear: 245,
    tint: { duration: 380, ease: 'cubic-bezier(0.22, 1, 0.36, 1)' },
    // The index abstract's exit — a different text from the chapter lede,
    // so it leaves line by line rather than morphing. Goes out with the rest.
    abstract: { y: -13, duration: 0.5, stagger: 0.163, ease: 'press' },
    // 3
    gap: 240,
    // 4
    duration: 1000,
    stagger: 69,
    ease: 'cubic-bezier(0.22, 1, 0.36, 1)',
    // Before act 1, and only when the words are off-screen: winding a
    // scrolled page back until what has to fly is visible.
    rewind: { duration: 940, ease: 'cubic-bezier(0.22, 1, 0.36, 1)', seat: 0.658 },
    phone: {
      hold: 200,
      clear: 380,
      tint: { duration: 300 },
      gap: 180,
      duration: 850,
      stagger: 120,
      rewind: { duration: 480 },
    },
    reduced: {
      hold: 0,
      clear: 0,
      tint: { duration: 0 },
      gap: 0,
      duration: 0,
      stagger: 0,
      rewind: { duration: 0 },
      abstract: { y: 0, duration: 0, stagger: 0 },
    },
  },
})
