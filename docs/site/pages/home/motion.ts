import { motion } from 'modulato'

export default motion({
  intro: {
    title: {
      yPercent: 110,
      duration: 1.2,
      ease: 'expo.out',
      phone: { yPercent: 70, duration: 0.9 },
      reduced: { yPercent: 0, duration: 0 },
    },
    // Everything below the title rises as ONE staggered tween.
    rise: {
      at: 0.3,
      y: 20,
      duration: 0.9,
      stagger: 0.13,
      ease: 'expo.out',
      reduced: { y: 0, duration: 0, at: 0, stagger: 0 },
    },
  },
  // Background cube ring: rotation speed, ring radius / cube half-size /
  // cube count (world units), camera height and distance above the ring
  // plane. The text column sits inside the ring.
  scene: {
    speed: 1,
    radius: 2.7,
    size: 0.42,
    count: 13,
    camHeight: 2.6,
    camDist: 3.4,
    // Print knockout over the text column (0 = none, 1 = fully clear).
    clear: 0.2,
    phone: { radius: 2.3, size: 0.38, count: 9, camHeight: 3.4, camDist: 4.8, clear: 1 },
    reduced: { speed: 0 },
  },
  // Paper Shaders HalftoneCmyk plate controls (Apache-2.0, paper.design).
  // size: dot scale 0..1; type: 0 dots, 1 ink, 2 sharp.
  print: {
    size: 0.72,
    softness: 0.2,
    contrast: 1.35,
    // Base K-plate dot printed even on white paper (0 = clean page).
    floodK: 0,
    gridNoise: 0.6,
    grainOverlay: 0.08,
    type: 0,
    phone: { size: 0.6 },
  },
})
