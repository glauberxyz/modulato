import { motion } from 'modulato'

/** Index motion — all tweakable live in the overlay. */
export default motion({
  intro: {
    smile: { scale: 0.6, duration: 0.9, ease: 'roller' },
    // `amount` is the whole sequence's span; `ease` shapes the gaps
    // between words rather than any movement.
    claim: { at: 0.2, amount: 0.9, ease: 'expo.out' },
    lede: { at: 0.6, y: 28, duration: 0.9, ease: 'press' },
    entries: { at: 0.75, y: 40, duration: 0.8, stagger: 0.07, ease: 'press' },
    phone: {
      claim: { amount: 0.7 },
      entries: { y: 24, duration: 0.6, stagger: 0.05 },
    },
    reduced: {
      smile: { scale: 1, duration: 0 },
      claim: { amount: 0, at: 0 },
      lede: { y: 0, duration: 0, at: 0 },
      entries: { y: 0, duration: 0, stagger: 0, at: 0 },
    },
  },
})
