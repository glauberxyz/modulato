import { motion } from 'modulato'

/**
 * Home intro tokens — data, not code, so Tweak Mode can edit + save them.
 * Breakpoint blocks (phone/tablet/reduced) deep-merge over the base: write
 * the animation once, vary the numbers per viewport.
 */
export default motion({
  intro: {
    headline: {
      yPercent: 120,
      duration: 1.1,
      stagger: 0.1,
      ease: 'expo.out',
      phone: { yPercent: 60, duration: 0.85, stagger: 0.06 },
      reduced: { yPercent: 0, duration: 0, stagger: 0 },
    },
    copy: {
      at: 0.4,
      y: 24,
      duration: 0.9,
      ease: 'expo.out',
      phone: { y: 12, duration: 0.7, at: 0.25 },
      reduced: { y: 0, duration: 0, at: 0 },
    },
    cards: {
      at: 0.55,
      y: 64,
      duration: 0.9,
      stagger: 0.08,
      ease: 'expo.out',
      phone: { y: 28, duration: 0.7, stagger: 0.05, at: 0.35 },
      reduced: { y: 0, duration: 0, stagger: 0, at: 0 },
    },
  },
})
