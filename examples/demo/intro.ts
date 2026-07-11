import gsap from 'gsap'
import { intro, resolveTokens } from 'modulato'
import tokens from './motion'

/**
 * Shell intro — first-load choreography for the PERSISTENT elements (menu,
 * marker), running alongside the page's own intro. The root intro.ts is the
 * piece glauber-2026 had no home for: the shell lives outside every page, so
 * no page intro can own it. Numbers live in ./motion.ts (Tweak Mode).
 */
export default intro({
  async run({ element }) {
    const { menu, marker } = resolveTokens(tokens).shell
    const tl = gsap.timeline()
    // .menu itself carries a centering transform and .marker's transform is
    // route-state-driven — animate what the shell doesn't already own.
    tl.from(
      element.querySelector('.menu__list'),
      { yPercent: menu.yPercent, duration: menu.duration, ease: menu.ease },
      0,
    )
    tl.from(
      element.querySelector('.marker'),
      { opacity: 0, duration: marker.duration, ease: marker.ease },
      marker.at,
    )
    await tl.then()
  },
})
