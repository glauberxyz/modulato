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
  // Background halftone squares: rotation speed, halftone dot size (px),
  // squares grid cell (viewport-height units).
  scene: {
    speed: 1,
    dot: 5,
    cell: 0.3,
    // Clear zone protecting the text column: center (fraction of viewport
    // height), inner radius (fully clear), outer radius (full ink).
    maskY: 0.7,
    maskIn: 0.3,
    maskOut: 0.75,
    phone: { dot: 4, cell: 0.42, maskY: 0.76, maskIn: 0.55, maskOut: 1.05 },
    reduced: { speed: 0 },
  },
})
