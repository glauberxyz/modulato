import gsap from 'gsap'
import { SplitText } from 'gsap/SplitText'
import { intro, resolveTokens } from 'modulato'
import tokens from './motion'

gsap.registerPlugin(SplitText)

/**
 * First load: the claim sets line by line, like a page coming off the press.
 * Numbers live in ./motion.ts — every one of them is tweakable live.
 */
export default intro({
  async run({ element }) {
    const { claim, lede, entries } = resolveTokens(tokens).intro
    const headline = element.querySelector<HTMLElement>('.home__claim')
    const tl = gsap.timeline()

    if (headline) {
      const split = new SplitText(headline, { type: 'lines', linesClass: 'line' })
      // Each line gets an inner span so it can slide inside its own mask.
      split.lines.forEach((line) => {
        const inner = document.createElement('span')
        inner.append(...line.childNodes)
        line.append(inner)
      })
      tl.from(
        split.lines.map((l) => l.firstElementChild),
        {
          yPercent: claim.yPercent,
          duration: claim.duration,
          stagger: claim.stagger,
          ease: claim.ease,
        },
        0,
      )
    }

    tl.from(
      element.querySelectorAll('.home__lede p'),
      { y: lede.y, opacity: 0, duration: lede.duration, ease: lede.ease, stagger: 0.08 },
      lede.at,
    )

    tl.from(
      element.querySelectorAll('.home__entry, .home__indexhead'),
      {
        y: entries.y,
        opacity: 0,
        duration: entries.duration,
        stagger: entries.stagger,
        ease: entries.ease,
      },
      entries.at,
    )

    await tl.then()
  },
})
