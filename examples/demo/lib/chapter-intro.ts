import gsap from 'gsap'
import { SplitText } from 'gsap/SplitText'
import { resolveTokens } from 'modulato'

gsap.registerPlugin(SplitText)

/**
 * Shared chapter opener: the title sets line by line, the lede follows.
 * Each chapter's own motion.ts supplies the numbers.
 */
export async function chapterIntro(element: HTMLElement, tokens: unknown) {
  const t = resolveTokens(tokens as never) as {
    title: { yPercent: number; duration: number; stagger: number; ease: string }
  }
  const heading = element.querySelector<HTMLElement>('.chapter__title')
  const tl = gsap.timeline()
  let split: SplitText | null = null

  if (heading && t.title.duration) {
    split = new SplitText(heading, { type: 'lines', linesClass: 'line' })
    split.lines.forEach((line) => {
      const inner = document.createElement('span')
      inner.append(...line.childNodes)
      line.append(inner)
    })
    // Per line, so each drops its mask as it lands — a single staggered
    // tween only completes with the last line, leaving descenders clipped
    // through its imperceptible eased tail.
    split.lines.forEach((line, i) => {
      tl.from(
        line.firstElementChild,
        {
          yPercent: t.title.yPercent,
          duration: t.title.duration,
          ease: t.title.ease,
          onComplete: () => {
            ;(line as HTMLElement).style.overflow = 'visible'
          },
        },
        i * t.title.stagger,
      )
    })
  }

  tl.from(
    element.querySelectorAll('.chapter__meta, .chapter__lede'),
    { y: 24, opacity: 0, duration: 0.8, stagger: 0.08, ease: 'press' },
    0.15,
  )

  await tl.then()
  // Belt and braces: if the tween was interrupted, onComplete never ran.
  split?.revert()
}
