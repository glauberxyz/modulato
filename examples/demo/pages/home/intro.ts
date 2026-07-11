import gsap from 'gsap'
import { SplitText } from 'gsap/SplitText'
import { intro } from 'modulato'

gsap.registerPlugin(SplitText)

/**
 * First-load intro for /: masked line-by-line text reveal on the headline
 * (fonts are guaranteed loaded — the framework awaits document.fonts.ready
 * before any intro runs), then the intro copy and the card grid stagger in.
 */
export default intro({
  async run({ element }) {
    const headline = element.querySelector<HTMLElement>('.home__headline')
    const tl = gsap.timeline({ defaults: { ease: 'expo.out' } })

    let split: SplitText | null = null
    if (headline) {
      split = new SplitText(headline, { type: 'lines', mask: 'lines' })
      tl.from(split.lines, { yPercent: 120, duration: 1.1, stagger: 0.1 }, 0)
    }
    tl.from(
      element.querySelector('.home__intro'),
      { y: 24, opacity: 0, duration: 0.9 },
      0.4,
    )
    tl.from(
      element.querySelectorAll('.home__card'),
      { y: 64, opacity: 0, duration: 0.9, stagger: 0.08 },
      0.55,
    )

    await tl.then()
    split?.revert()
  },
})
