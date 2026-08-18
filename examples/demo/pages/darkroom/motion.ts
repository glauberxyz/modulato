import { motion } from 'modulato'

/** Darkroom — the panel beside the print.
 *
 * The `scene` group is gone with the raymarched scene it drove: the stage is a
 * screened photograph now, and every number that shapes it is a shader uniform
 * the reader drives directly, not a motion token. */
export default motion({
  panel: {
    x: 40,
    duration: 0.9,
    stagger: 0.03,
    ease: 'press',
    reduced: { x: 0, duration: 0, stagger: 0 },
  },
})
