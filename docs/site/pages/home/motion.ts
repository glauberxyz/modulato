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
    tagline: {
      at: 0.3,
      y: 22,
      duration: 0.9,
      ease: 'expo.out',
      reduced: { y: 0, duration: 0, at: 0 },
    },
    command: {
      at: 0.45,
      y: 22,
      duration: 0.9,
      ease: 'expo.out',
      reduced: { y: 0, duration: 0, at: 0 },
    },
    note: {
      at: 0.58,
      y: 16,
      duration: 0.9,
      ease: 'expo.out',
      reduced: { y: 0, duration: 0, at: 0 },
    },
    links: {
      at: 0.7,
      y: 14,
      duration: 0.8,
      ease: 'expo.out',
      reduced: { y: 0, duration: 0, at: 0 },
    },
  },
  // Background cube ring: rotation speed, halftone dot size (px), ring
  // radius / cube half-size / cube count (world units), camera height and
  // distance above the ring plane. The text column sits inside the ring.
  scene: {
    speed: 1,
    dot: 5,
    radius: 2.7,
    size: 0.42,
    count: 11,
    camHeight: 2.3,
    camDist: 3.6,
    // Print knockout over the text column (0 = none, 1 = fully clear).
    clear: 0.35,
    phone: { dot: 4, radius: 2.3, size: 0.38, count: 9, camHeight: 3.4, camDist: 4.8, clear: 1 },
    reduced: { speed: 0 },
  },
})
