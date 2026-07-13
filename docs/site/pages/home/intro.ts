import gsap from 'gsap'
import { SplitText } from 'gsap/SplitText'
import { intro, resolveTokens } from 'modulato'
import tokens from './motion'

gsap.registerPlugin(SplitText)

export default intro({
  async run({ element }) {
    const { title, tagline, command, note, links } = resolveTokens(tokens).intro
    const titleEl = element.querySelector<HTMLElement>('.home__title')
    const tl = gsap.timeline()

    let split: SplitText | null = null
    if (titleEl) {
      split = new SplitText(titleEl, { type: 'lines', mask: 'lines' })
      tl.from(split.lines, { yPercent: title.yPercent, duration: title.duration, ease: title.ease }, 0)
    }
    tl.from(element.querySelector('.home__tagline'),
      { y: tagline.y, opacity: 0, duration: tagline.duration, ease: tagline.ease }, tagline.at)
    tl.from(element.querySelector('.home__command'),
      { y: command.y, opacity: 0, duration: command.duration, ease: command.ease }, command.at)
    tl.from(element.querySelector('.home__note'),
      { y: note.y, opacity: 0, duration: note.duration, ease: note.ease }, note.at)
    tl.from(element.querySelectorAll('.home__links a'),
      { y: links.y, opacity: 0, duration: links.duration, stagger: 0.07, ease: links.ease }, links.at)

    await tl.then()
    split?.revert()
  },
})
