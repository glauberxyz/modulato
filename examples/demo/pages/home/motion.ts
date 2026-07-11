import { motion } from 'modulato'

/** Home intro tokens — data, not code, so Tweak Mode can edit + save them. */
export default motion({
  intro: {
    headline: { yPercent: 120, duration: 1.1, stagger: 0.1, ease: 'expo.out' },
    copy: { at: 0.4, y: 24, duration: 0.9, ease: 'expo.out' },
    cards: { at: 0.55, y: 64, duration: 0.9, stagger: 0.08, ease: 'expo.out' },
  },
})