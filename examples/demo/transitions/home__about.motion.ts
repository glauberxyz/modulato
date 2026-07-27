import { motion } from 'modulato'

/** Slide-transition tokens — colocated with the pair file, tweakable live. */
export default motion({
  slide: {
    duration: 1064,
    // The config's "swoosh" curve — transitions run on WAAPI, which only
    // speaks CSS, so the same declared ease lands here as its cubic-bezier.
    ease: 'cubic-bezier(0.62, 0.05, 0.01, 0.99)',
    phone: { duration: 500 },
    reduced: { duration: 0 },
  },
})