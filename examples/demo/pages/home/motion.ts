import { motion } from 'modulato'

/** Index motion + the shader's own uniforms — all tweakable live. */
export default motion({
  intro: {
    claim: { yPercent: 108, duration: 1.15, stagger: 0.08, ease: 'roller' },
    lede: { at: 0.35, y: 28, duration: 0.9, ease: 'press' },
    entries: { at: 0.5, y: 40, duration: 0.8, stagger: 0.07, ease: 'press' },
    phone: {
      claim: { yPercent: 100, duration: 0.9, stagger: 0.05 },
      entries: { y: 24, duration: 0.6, stagger: 0.05 },
    },
    reduced: {
      claim: { yPercent: 0, duration: 0, stagger: 0 },
      lede: { y: 0, duration: 0, at: 0 },
      entries: { y: 0, duration: 0, stagger: 0, at: 0 },
    },
  },
})
