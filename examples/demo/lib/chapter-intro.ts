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
    title: { amount: number; ease: string }
  }
  const heading = element.querySelector<HTMLElement>('.chapter__title')
  const tl = gsap.timeline()
  let split: SplitText | null = null

  if (heading) {
    // Same as the index: the ease shapes the rhythm of appearance, not
    // any motion. Times computed explicitly — see the note there.
    split = new SplitText(heading, { type: 'words' })
    const words = split.words
    const curve = gsap.parseEase(t.title.ease) ?? ((p: number) => p)
    tl.set(words, { opacity: 0 }, 0)
    words.forEach((word, i) => {
      const at = words.length > 1 ? curve(i / (words.length - 1)) : 0
      tl.set(word, { opacity: 1 }, at * t.title.amount)
    })
    // Clear of the last word: the revert restores the original DOM, and
      // firing it on the same frame as the final set() is a race.
      tl.call(() => split?.revert(), undefined, t.title.amount + 0.12)
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
