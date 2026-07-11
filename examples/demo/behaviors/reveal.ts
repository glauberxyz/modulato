import gsap from 'gsap'
import { enhance } from 'modulato'

/**
 * Reveal-on-scroll for any `[data-reveal]` node — including HTML the site
 * doesn't render itself (CMS rich text). Applied when the page mounts,
 * cleaned up when it unmounts. Tune per node with data attributes:
 *
 *   <img data-reveal data-reveal-delay="0.15" data-reveal-distance="80" />
 */
export default enhance('[data-reveal]', ({ element, data }) => {
  const distance = Number(data.revealDistance ?? 40)
  gsap.set(element, { opacity: 0, y: distance })

  const observer = new IntersectionObserver(
    ([entry]) => {
      if (!entry.isIntersecting) return
      observer.disconnect()
      gsap.to(element, {
        opacity: 1,
        y: 0,
        duration: 1,
        ease: 'power3.out',
        delay: Number(data.revealDelay ?? 0),
      })
    },
    { threshold: 0.15 },
  )
  observer.observe(element)

  return () => {
    observer.disconnect()
    gsap.killTweensOf(element)
  }
})
