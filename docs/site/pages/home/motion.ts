import { motion } from 'modulato'

export default motion({
  intro: {
    title: {
      yPercent: 110,
      duration: 1.2,
      // Per-letter cascade across "Modulato".
      stagger: 0.045,
      ease: 'expo.out',
      phone: { yPercent: 70, duration: 0.9 },
      reduced: { yPercent: 0, duration: 0, stagger: 0 },
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
  // A circle of tall pillars, front-on. count/radius/height shape the
  // sequence; camHeight looks down from slightly above (0 = dead level),
  // camDist pulls the camera back, bandY places the circle vertically on
  // screen (uv units, + = up).
  scene: {
    speed: 0.248,
    radius: 1.38,
    count: 26,
    height: 0.096,
    camHeight: 0.3,
    camDist: 4.21,
    bandY: 0.335,
    // Brightest printable tone (lower = lit faces keep more dots; at 1 a
    // fully lit pillar disappears into the white paper).
    highlightCap: 0.897,
    // Print knockout over the text column (0 = none, 1 = fully clear).
    clear: 0.8,
    phone: { count: 36, camDist: 2.76, bandY: 0.567, clear: 1 },
    reduced: { speed: 0 },
  },
  // Paper Shaders HalftoneCmyk plate controls (Apache-2.0, paper.design).
  // size: dot scale 0..1; type: 0 dots, 1 ink, 2 sharp.
  print: {
    size: 0.3,
    softness: 0,
    contrast: 1.2,
    // Base K-plate dot printed even on white paper (0 = clean page).
    floodK: 0,
    gridNoise: 0.3,
    grainOverlay: 0.08,
    type: 0,
    phone: { size: 0.352 },
  },
})