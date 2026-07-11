import gsap from 'gsap'
import { SplitText } from 'gsap/SplitText'
import { intro, resolveTokens } from 'modulato'
import tokens from './motion'

gsap.registerPlugin(SplitText)

/**
 * First-load intro for /: masked line-by-line text reveal on the headline
 * (fonts are guaranteed loaded — the framework awaits document.fonts.ready
 * before any intro runs), then the intro copy and the card grid stagger in.
 * All numbers live in ./motion.ts — tweak them live in the dev overlay.
 */
export default intro({
  async run({ element }) {
    // Resolved at run time: the current breakpoint's (and reduced-motion)
    // overrides are already merged in.
    const { headline, copy, cards } = resolveTokens(tokens).intro
    const headlineEl = element.querySelector<HTMLElement>('.home__headline')
    const tl = gsap.timeline()

    let split: SplitText | null = null
    if (headlineEl) {
      split = new SplitText(headlineEl, { type: 'lines', mask: 'lines' })
      tl.from(
        split.lines,
        {
          yPercent: headline.yPercent,
          duration: headline.duration,
          stagger: headline.stagger,
          ease: headline.ease,
        },
        0,
      )
    }
    tl.from(
      element.querySelector('.home__intro'),
      { y: copy.y, opacity: 0, duration: copy.duration, ease: copy.ease },
      copy.at,
    )
    tl.from(
      element.querySelectorAll('.home__card'),
      {
        y: cards.y,
        opacity: 0,
        duration: cards.duration,
        stagger: cards.stagger,
        ease: cards.ease,
      },
      cards.at,
    )

    await tl.then()
    split?.revert()
  },
})
