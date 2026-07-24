import { motion } from 'modulato'

/** Shell motion tokens — tweakable live in the dev overlay (✦ motion). */
export default motion({
  shell: {
    menu: {
      yPercent: -174,
      duration: 1,
      ease: 'expo.out',
      phone: { yPercent: -160, duration: 0.8 },
      reduced: { yPercent: 0, duration: 0 },
    },
    marker: {
      at: 0.2,
      duration: 1.4,
      ease: 'power2.inOut',
      phone: { duration: 1, at: 0.1 },
      reduced: { duration: 0, at: 0 },
    },
  },
  // The persistent canvas square (shell/Scene.tsx): idle spin in rad/s,
  // spin boost + scale-down while a page transition runs.
  scene: {
    spin: 0.275,
    boost: 3.11,
    shrink: 1.14,
    phone: { spin: 0.35 },
    reduced: { spin: 0, boost: 1, shrink: 1 },
  },
})