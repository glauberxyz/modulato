import gsap from 'gsap'
import { SplitText } from 'gsap/SplitText'
import { intro, resolveTokens } from 'modulato'
import tokens from './motion'

gsap.registerPlugin(SplitText)

export default intro({
  async run({ element }) {
    const { title, rise } = resolveTokens(tokens).intro
    const titleEl = element.querySelector<HTMLElement>('.home__title')
    const tl = gsap.timeline()

    let split: SplitText | null = null
    if (titleEl) {
      split = new SplitText(titleEl, { type: 'chars', mask: 'chars' })
      tl.from(
        split.chars,
        { yPercent: title.yPercent, duration: title.duration, stagger: title.stagger, ease: title.ease },
        0,
      )
    }
    tl.from(
      element.querySelectorAll('.home__tagline, .home__command, .home__note, .home__links a'),
      { y: rise.y, opacity: 0, duration: rise.duration, stagger: rise.stagger, ease: rise.ease },
      rise.at,
    )

    await tl.then()
    split?.revert()
  },
})
