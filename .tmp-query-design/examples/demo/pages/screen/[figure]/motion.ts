import { motion } from 'modulato'

/** Plate inspector — the sheet settles under the flown image. */
export default motion({
  sheet: {
    y: 40,
    duration: 0.85,
    stagger: 0.06,
    at: 0.25,
    ease: 'press',
    reduced: { y: 0, duration: 0, stagger: 0, at: 0 },
  },
})
