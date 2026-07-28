import { motion } from 'modulato'

export default motion({
  bleed: {
    duration: 620,
    // A transition runs on WAAPI, which only speaks CSS — so the config's
    // "press" curve appears here as its cubic-bezier.
    ease: 'cubic-bezier(0.16, 1, 0.3, 1)',
    phone: { duration: 460 },
    reduced: { duration: 0 },
  },
})
