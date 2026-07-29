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

    const smileEl = element.querySelector<HTMLElement>('.home__smile')
    if (smileEl) {
      // Drops in from outside the viewport. The distance is MEASURED —
      // its own bottom edge plus a clearance — so it starts genuinely
      // off-screen at any window height rather than at a guessed offset.
      const travel = smileEl.getBoundingClientRect().bottom + smile.clearance
      tl.from(
        smileEl,
        {
          y: -travel,
          scale: smile.scale,
          duration: smile.duration,
          ease: smile.ease,
        },
        smile.at,
      )
    }

    if (headline) {
      // Words, not lines — and no masks, so nothing can clip a descender.
      // Each word simply appears; the EASE shapes the SEQUENCE rather than
      // any movement, so "There" lands alone and the rest tumble in after
      // it, the gaps tightening as the line fills.
      //
      // The times are computed rather than left to a staggered tween: a
      // zero-duration tween never applies its from-state, so the words all
      // arrived at once.
      split = new SplitText(headline, { type: 'words' })
      const words = split.words
      const curve = gsap.parseEase(claim.ease) ?? ((p: number) => p)
      tl.set(words, { opacity: 0 }, 0)
      words.forEach((word, i) => {
        const at = words.length > 1 ? curve(i / (words.length - 1)) : 0
        tl.set(word, { opacity: 1 }, claim.at + at * claim.amount)
      })
      // Clear of the last word: the revert restores the original DOM, and
      // firing it on the same frame as the final set() is a race.
      tl.call(() => split?.revert(), undefined, claim.at + claim.amount + 0.12)
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
