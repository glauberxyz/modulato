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
  // Background cube ring seen FRONT-ON, full width: camera level with the
  // ring plane, pulled back outside it — the near arc prints big and dark,
  // the back half dissolves to white. camHeight tilts off the plane (0 =
  // pure front view), camDist is the pull-back from ring center, bandY
  // places the band vertically on screen (uv units, + = up).
  scene: {
    speed: 0.847,
    radius: 3.11,
    size: 0.203,
    count: 31,
    camHeight: 0,
    camDist: 6.21,
    bandY: 0.269,
    // Cubes print strongest mid-viewport, fading toward the side edges.
    centerFocus: 0.8,
    // Print knockout over the text column (0 = none, 1 = fully clear).
    clear: 0.8,
    phone: { size: 0.34, count: 9, camDist: 7, bandY: 0.3, clear: 1 },
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
    phone: { size: 0.6 },
  },
})