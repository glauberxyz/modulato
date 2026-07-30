import { motion } from 'modulato'

/** Index motion — all tweakable live in the overlay. */
export default motion({
  intro: {
    // Prints in place — it grows at `at` rather than arriving from
    // anywhere. `scale` and `opacity` are both where it STARTS: at any
    // scale above 0 the smile is on the page from the first frame, so
    // opacity is what keeps it off until its moment. Set it to 1 for a
    // pure scale, or raise it to have the growth only half-fade.
    smile: { at: 1.64, scale: 0.6, opacity: 0, duration: 1.1, ease: 'roller' },
    // `amount` is the whole sequence's span; `ease` shapes the gaps
    // between words rather than any movement.
    claim: { at: 0.562, amount: 0.887, ease: 'none' },
    lede: { at: 1.6, y: 35.9, duration: 0.9, ease: 'press' },
    entries: { at: 1.423, y: 40, duration: 0.8, stagger: 0.07, ease: 'press' },
    phone: {
      claim: { amount: 0.7 },
      entries: { y: 24, duration: 0.6, stagger: 0.05 },
    },
    reduced: {
      smile: { at: 0, scale: 1, opacity: 1, duration: 0 },
      claim: { amount: 0, at: 0 },
      lede: { y: 0, duration: 0, at: 0 },
      entries: { y: 0, duration: 0, stagger: 0, at: 0 },
    },
  },
})