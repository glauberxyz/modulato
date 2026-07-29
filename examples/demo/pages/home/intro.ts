import gsap from 'gsap'
import { SplitText } from 'gsap/SplitText'
import { intro, resolveTokens } from 'modulato'
import tokens from './motion'

gsap.registerPlugin(SplitText)

/**
 * First load: the smile prints, then the claim sets line by line and the
 * contents rise. Numbers live in ./motion.ts.
 */
export default intro({
  async run({ element }) {
    const { smile, claim, lede, entries } = resolveTokens(tokens).intro
    const headline = element.querySelector<HTMLElement>('.home__claim')
    const tl = gsap.timeline()
    // Held so the split can be undone when the animation lands — the line
    // masks that make the slide work would otherwise clip descenders
    // (g, y, p) for the life of the page.
    let split: SplitText | null = null

    tl.from(
      element.querySelector('.home__smile'),
      { scale: smile.scale, opacity: 0, duration: smile.duration, ease: smile.ease },
      0,
    )

    if (headline) {
      split = new SplitText(headline, { type: 'lines', linesClass: 'line' })
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
        claim.at,
      )
    }

    tl.from(
      element.querySelectorAll('.home__lede, .home__note'),
      { y: lede.y, opacity: 0, duration: lede.duration, ease: lede.ease, stagger: 0.08 },
      lede.at,
    )

    tl.from(
      element.querySelectorAll('.home__contents, .entry'),
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
    // Back to plain text: no clipping, and the line breaks are free to
    // re-wrap on resize instead of being frozen at their split positions.
    split?.revert()
  },
})
