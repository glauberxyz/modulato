import { transition, flipShared } from 'modulato'

/** Home grid ↔ project detail: same shared-element choreography as work ↔ detail. */
export default transition({
  symmetric: true,
  async run({ from, to, shared }) {
    const fades = [
      from.element.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: 350,
        easing: 'ease',
        fill: 'forwards',
      }).finished,
      to.element.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: 500,
        easing: 'ease',
        fill: 'forwards',
      }).finished,
    ]
    await Promise.all([
      ...shared.map((pair) =>
        flipShared(pair, { duration: 700, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' }),
      ),
      ...fades,
    ]).catch(() => {})
  },
})
