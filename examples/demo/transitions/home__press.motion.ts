import { motion } from 'modulato'

/** The word flight. Paced to be watched — stagger is the whole point. */
export default motion({
  flight: {
    duration: 900,
    stagger: 110,
    clear: 420,
    bodyAt: 0.35,
    ease: 'cubic-bezier(0.62, 0.05, 0.01, 0.99)',
    // The index abstract's exit — a different text from the chapter lede,
    // so it leaves line by line rather than morphing.
    abstract: { y: -18, duration: 0.42, stagger: 0.05, ease: 'press' },
    phone: { duration: 700, stagger: 80, clear: 320 },
    reduced: {
      duration: 0,
      stagger: 0,
      clear: 0,
      abstract: { y: 0, duration: 0, stagger: 0 },
    },
  },
})
