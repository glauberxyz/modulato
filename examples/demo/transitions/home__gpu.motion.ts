import { motion } from 'modulato'

/** Plate registration — index → chapter. */
export default motion({
  registration: {
    duration: 900,
    spread: 90,
    dot: 26,
    // The config's "roller" curve, in the spelling WAAPI understands.
    ease: 'cubic-bezier(0.62, 0.05, 0.01, 0.99)',
    phone: { duration: 680, spread: 54 },
    reduced: { duration: 0 },
  },
})
