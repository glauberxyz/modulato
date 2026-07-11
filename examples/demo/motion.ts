import { motion } from 'modulato'

/** Shell motion tokens — tweakable live in the dev overlay (✦ motion). */
export default motion({
  shell: {
    menu: { yPercent: -220, duration: 1, ease: 'expo.out' },
    marker: { at: 0.2, duration: 1.4, ease: 'power2.inOut' },
  },
})
