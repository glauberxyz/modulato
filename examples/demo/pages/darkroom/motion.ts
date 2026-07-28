import { motion } from 'modulato'

/** Darkroom — the scene behind the controls. */
export default motion({
  scene: {
    speed: 1,
    radius: 2.1,
    height: 1.2,
    count: 26,
    camHeight: 0.25,
    camDist: 4.4,
    band: 0,
    cap: 0.95,
    phone: { radius: 1.6, count: 18, camDist: 5.4 },
    reduced: { speed: 0 },
  },
  panel: {
    x: 40,
    duration: 0.9,
    stagger: 0.03,
    ease: 'press',
    reduced: { x: 0, duration: 0, stagger: 0 },
  },
})
