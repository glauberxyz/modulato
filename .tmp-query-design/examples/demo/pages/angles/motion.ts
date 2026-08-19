import { motion } from 'modulato'

/** Chapter III motion — the scroll reveals. */
export default motion({
  reveal: {
    y: 44,
    duration: 0.95,
    stagger: 0.06,
    ease: 'press',
    start: 0.85,
    phone: { y: 24, duration: 0.7 },
    reduced: { y: 0, duration: 0, stagger: 0 },
  },
})
