import { motion } from 'modulato'

/**
 * The word flight. Paced to be watched — this is the showcase move, so it
 * takes its time: a hold while the clones settle exactly over the words
 * they replaced, then a long stagger so each word reads on its own.
 */
export default motion({
  flight: {
    hold: 280,
    // Winding a scrolled chapter back to its own title before the words
    // leave it. Skipped entirely when the title is already on screen.
    rewind: { duration: 620, ease: 'cubic-bezier(0.65, 0, 0.35, 1)', seat: 0.16 },
    duration: 1150,
    stagger: 170,
    clear: 982,
    ease: 'cubic-bezier(0.62, 0.05, 0.01, 0.99)',
    // The index abstract's exit — a different text from the chapter lede,
    // so it leaves line by line rather than morphing.
    abstract: { y: -18, duration: 0.5, stagger: 0.06, ease: 'press' },
    phone: {
      hold: 200,
      duration: 850,
      stagger: 120,
      clear: 380,
      rewind: { duration: 480 },
    },
    reduced: {
      hold: 0,
      rewind: { duration: 0 },
      duration: 0,
      stagger: 0,
      clear: 0,
      abstract: { y: 0, duration: 0, stagger: 0 },
    },
  },
})