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

  if (heading && t.title.duration) {
    const split = new SplitText(heading, { type: 'lines', linesClass: 'line' })
    split.lines.forEach((line) => {
      const inner = document.createElement('span')
      inner.append(...line.childNodes)
      line.append(inner)
    })
    tl.from(
      split.lines.map((l) => l.firstElementChild),
      {
        yPercent: t.title.yPercent,
        duration: t.title.duration,
        stagger: t.title.stagger,
        ease: t.title.ease,
      },
      0,
    )
  }

  tl.from(
    element.querySelectorAll('.chapter__meta, .chapter__lede'),
    { y: 24, opacity: 0, duration: 0.8, stagger: 0.08, ease: 'press' },
    0.15,
  )

  await tl.then()
}
