import { intro } from 'modulato'

/**
 * First-load intro for /work: every card starts stacked at the viewport
 * center, then falls into its grid slot with a stagger. Runs only on initial
 * load — page-to-page navigation uses transitions/ instead.
 */
export default intro({
  async run({ element }) {
    const title = element.querySelector('.work__title')
    const cards = Array.from(element.querySelectorAll<HTMLElement>('.work__card'))

    title?.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: 700,
      easing: 'ease',
      fill: 'backwards',
    })

    const cx = window.innerWidth / 2
    const cy = window.innerHeight / 2
    await Promise.all(
      cards.map((card, index) => {
        const rect = card.getBoundingClientRect()
        const dx = cx - (rect.left + rect.width / 2)
        const dy = cy - (rect.top + rect.height / 2)
        return card.animate(
          [
            { transform: `translate(${dx}px, ${dy}px) scale(0.7)`, opacity: 0 },
            {
              transform: `translate(${dx * 0.5}px, ${dy * 0.5}px) scale(0.85)`,
              opacity: 1,
              offset: 0.45,
            },
            { transform: 'translate(0, 0) scale(1)', opacity: 1 },
          ],
          {
            duration: 950,
            delay: index * 130,
            easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
            // `backwards` holds the first keyframe during the stagger delay —
            // cards never flash in their resting position.
            fill: 'backwards',
          },
        ).finished
      }),
    ).catch(() => {})
  },
})
