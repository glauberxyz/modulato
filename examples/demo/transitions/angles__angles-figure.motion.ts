import { motion } from 'modulato'

/** The plate FLIP — figure to inspector. */
export default motion({
  flip: {
    duration: 820,
    ease: 'cubic-bezier(0.62, 0.05, 0.01, 0.99)',
    phone: { duration: 600 },
    reduced: { duration: 0 },
  },
})
