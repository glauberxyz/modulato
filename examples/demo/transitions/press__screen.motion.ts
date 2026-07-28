import { motion } from 'modulato'

/** Paper feed — sheet out, sheet in. */
export default motion({
  feed: {
    duration: 760,
    skew: 1.6,
    ease: 'cubic-bezier(0.16, 1, 0.3, 1)',
    phone: { duration: 560, skew: 1 },
    reduced: { duration: 0 },
  },
})
