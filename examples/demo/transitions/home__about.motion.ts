import { motion } from 'modulato'

/** Slide-transition tokens — colocated with the pair file, tweakable live. */
export default motion({
  slide: {
    duration: 700,
    ease: 'cubic-bezier(0.7, 0, 0.2, 1)',
    phone: { duration: 500 },
    reduced: { duration: 0 },
  },
})
