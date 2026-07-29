import { motion } from 'modulato'

/** Index motion — all tweakable live in the overlay. */
export default motion({
  intro: {
    // Falls in from above the viewport. `clearance` is how far past the
    // top edge it starts; the rest of the distance is measured.
    smile: { at: 1.15, clearance: 80, scale: 0.919, duration: 1.1, ease: 'roller' },
    // `amount` is the whole sequence's span; `ease` shapes the gaps
    // between words rather than any movement.
    claim: { at: 0.562, amount: 0.887, ease: 'none' },
    lede: { at: 1.9, y: 35.9, duration: 0.9, ease: 'press' },
    entries: { at: 1.423, y: 40, duration: 0.8, stagger: 0.07, ease: 'press' },
    phone: {
      claim: { amount: 0.7 },
      entries: { y: 24, duration: 0.6, stagger: 0.05 },
    },
    reduced: {
      smile: { at: 0, clearance: 0, scale: 1, duration: 0 },
      claim: { amount: 0, at: 0 },
      lede: { y: 0, duration: 0, at: 0 },
      entries: { y: 0, duration: 0, stagger: 0, at: 0 },
    },
  },
})