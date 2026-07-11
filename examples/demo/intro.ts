import gsap from 'gsap'
import { intro } from 'modulato'

/**
 * Shell intro — first-load choreography for the PERSISTENT elements (menu,
 * marker), running alongside the page's own intro. The root intro.ts is the
 * piece glauber-2026 had no home for: the shell lives outside every page, so
 * no page intro can own it.
 */
export default intro({
  async run({ element }) {
    const tl = gsap.timeline({ defaults: { ease: 'expo.out' } })
    // .menu itself carries a centering transform and .marker's transform is
    // route-state-driven — animate what the shell doesn't already own.
    tl.from(element.querySelector('.menu__list'), { yPercent: -220, duration: 1 }, 0)
    tl.from(
      element.querySelector('.marker'),
      { opacity: 0, duration: 1.4, ease: 'power2.inOut' },
      0.2,
    )
    await tl.then()
  },
})
