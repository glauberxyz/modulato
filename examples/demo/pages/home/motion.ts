import { motion } from 'modulato'

/** Index motion — all tweakable live in the overlay. Overrides sit next to
 *  the group they modify, so each group folds into its own icon tabs. */
export default motion({
  intro: {
    // Prints in place — it grows at `at` rather than arriving from
    // anywhere. `scale` and `opacity` are both where it STARTS: at any
    // scale above 0 the smile is on the page from the first frame, so
    // opacity is what keeps it off until its moment. Set it to 1 for a
    // pure scale, or raise it to have the growth only half-fade.
    smile: {
      at: 1.64,
      scale: 0.6,
      opacity: 0,
      duration: 1.1,
      ease: 'roller',
      reduced: { at: 0, scale: 1, opacity: 1, duration: 0 },
    },
    // `amount` is the whole sequence's span; `ease` shapes the gaps
    // between words rather than any movement.
    claim: {
      at: 0.562,
      amount: 0.887,
      ease: 'none',
      phone: { amount: 0.7 },
      reduced: { amount: 0, at: 0 },
    },
    lede: {
      at: 1.6,
      y: 35.9,
      duration: 0.9,
      ease: 'press',
      reduced: { y: 0, duration: 0, at: 0 },
    },
    entries: {
      at: 1.423,
      y: 40,
      duration: 0.8,
      stagger: 0.07,
      ease: 'press',
      phone: { y: 24, duration: 0.6, stagger: 0.05 },
      reduced: { y: 0, duration: 0, stagger: 0, at: 0 },
    },
  },

  /**
   * The reading head: scrolling the hero lights each word of the lede in
   * turn and hands the light to the next, so it travels rather than
   * accumulating.
   */
  read: {
    // The scroll window, as fractions of the viewport height: the sweep
    // begins when the lede's top crosses `start` and finishes when its
    // bottom crosses `end`. Lower `end` = a longer scroll to get through it.
    start: 0.6,
    end: 0.25,
    // Seconds the playhead takes to catch up with the scroll. 0 links it
    // rigidly; higher trails behind and glides on after you stop.
    scrub: 0.6,
    // RELATIVE units, not seconds — the scrub stretches the whole sequence
    // across the scroll window, so only the ratios matter. `rise + fall`
    // greater than `stagger` keeps several words lit at once, as a soft
    // band; less, and a single word travels alone.
    stagger: 0.31,
    rise: 0.6,
    fall: 2.2,
    // `rise: 0` switches the whole effect off — the lede just sits in its
    // resting colour.
    reduced: { rise: 0 },
  },
})