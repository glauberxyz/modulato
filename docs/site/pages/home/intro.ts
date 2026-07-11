import gsap from 'gsap'
import { SplitText } from 'gsap/SplitText'
import { intro, resolveTokens } from 'modulato'
import tokens from './motion'

gsap.registerPlugin(SplitText)

export default intro({
  async run({ element }) {
    const { title, description, command, links } = resolveTokens(tokens).intro
    const titleEl = element.querySelector<HTMLElement>('.home__title')
    const tl = gsap.timeline()

    let split: SplitText | null = null
    if (titleEl) {
      split = new SplitText(titleEl, { type: 'lines', mask: 'lines' })
      tl.from(split.lines, { yPercent: title.yPercent, duration: title.duration, ease: title.ease }, 0)
    }
    tl.from(element.querySelector('.home__description'),
      { y: description.y, opacity: 0, duration: description.duration, ease: description.ease }, description.at)
    tl.from(element.querySelector('.home__command'),
      { y: command.y, opacity: 0, duration: command.duration, ease: command.ease }, command.at)
    // The links live in the SHELL — the page intro may still reach outside
    // its element for first-load choreography via document.
    tl.from(document.querySelectorAll('.links a'),
      { y: links.y, opacity: 0, duration: links.duration, stagger: 0.07, ease: links.ease }, links.at)

    await tl.then()
    split?.revert()
  },
})
