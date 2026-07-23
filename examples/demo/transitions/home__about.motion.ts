import { motion } from 'modulato'

/** Slide-transition tokens — colocated with the pair file, tweakable live. */
export default motion({
  slide: {
    duration: 1064,
    ease: 'cubic-bezier(0.16, 1, 0.3, 1)',
    phone: { duration: 500 },
    reduced: { duration: 0 },
  },
})