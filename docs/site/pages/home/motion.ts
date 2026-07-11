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
    description: {
      at: 0.35,
      y: 22,
      duration: 0.9,
      ease: 'expo.out',
      reduced: { y: 0, duration: 0, at: 0 },
    },
    command: {
      at: 0.5,
      y: 22,
      duration: 0.9,
      ease: 'expo.out',
      reduced: { y: 0, duration: 0, at: 0 },
    },
    links: {
      at: 0.7,
      y: -14,
      duration: 0.8,
      ease: 'expo.out',
      reduced: { y: 0, duration: 0, at: 0 },
    },
  },
})
