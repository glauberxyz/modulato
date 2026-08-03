import { motion } from 'modulato'

/** Chapter III motion — scroll reveals and the figure parallax. */
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
  figure: {
    // How far a figure drifts against the scroll, in px over its travel.
    parallax: 44,
    scale: 1.06,
    phone: { parallax: 20 },
    reduced: { parallax: 0, scale: 1 },
  },
})
