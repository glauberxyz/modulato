import { motion } from 'modulato'

/** Shell motion tokens — tweakable live in the dev overlay (✦ Tweak). */
export default motion({
  marker: {
    // Scroll-fill smoothing, in units/second toward the target.
    lerp: 6,
    phone: { lerp: 8 },
    reduced: { lerp: 100 },
  },
  runhead: {
    duration: 0.5,
    ease: 'press',
    reduced: { duration: 0 },
  },
})
