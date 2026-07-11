import { motion } from 'modulato'

export default motion({
  marquee: {
    duration: 12,
    // Reduced motion: duration 0 tells the page to skip the loop entirely.
    reduced: { duration: 0 },
  },
  parallax: {
    strength: 11,
    phone: { strength: 6 },
    reduced: { strength: 0 },
  },
})
