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
      // One tween PER LINE rather than one staggered tween, so each line can
      // drop its own mask the moment it lands. A single staggered tween only
      // reports completion once the last line finishes, and its eased tail
      // is imperceptible — which left descenders (g, y, p) clipped for a
      // beat after the title had visibly stopped.
      split.lines.forEach((line, i) => {
        tl.from(
          line.firstElementChild,
          {
            yPercent: claim.yPercent,
            duration: claim.duration,
            ease: claim.ease,
            onComplete: () => {
              ;(line as HTMLElement).style.overflow = 'visible'
            },
          },
          claim.at + i * claim.stagger,
        )
      })
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
    // Belt and braces: if the tween was interrupted, onComplete never ran.
    split?.revert()
  },
})
