import gsap from 'gsap'
import { resolveTokens } from 'modulato'
import site from '../motion'

/**
 * A chapter's opening on a COLD landing — arriving from the index flies the
 * title into place instead (transitions/home__*.ts), and this never runs.
 *
 * One stagger over the head. The title used to set word by word, borrowed
 * from the index's claim, but the two are not the same object: the claim is a
 * long line the eye reads across, while a chapter title is two or three
 * stacked words that are already the largest thing on the page — sequencing
 * them read as a list assembling itself rather than as a page arriving.
 */
export async function chapterIntro(element: HTMLElement) {
  const { opening } = resolveTokens(site)
  if (!opening.duration) return
  await gsap.from(element.querySelectorAll('.chapter__title, .chapter__lede'), {
    y: opening.y,
    opacity: 0,
    duration: opening.duration,
    stagger: opening.stagger,
    ease: opening.ease,
  })
}
