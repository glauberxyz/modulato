import { ticker } from 'modulato'

/**
 * Run `callback` once per frame, AFTER every requestAnimationFrame callback
 * of that frame and after layout — but before paint.
 *
 * Why it exists: a plane has to be drawn where its element IS this frame, and
 * the things that move elements run in rAF callbacks of their own — the
 * framework ticker (Lenis, `useTicker`) and GSAP's ticker, in that order. Draw
 * from the framework ticker and every GSAP-driven plane (a ScrollTrigger
 * parallax, a reveal) trails its element by one frame; it shows as a shimmer
 * against the text beside it.
 *
 * The platform has no "after rAF" callback, but ResizeObserver deliveries are
 * specified to land exactly there: after the animation-frame callbacks, after
 * style and layout, before paint, in the same rendering update. So the ticker
 * nudges a 0-height probe's width every frame, and the observer's delivery is
 * the hook. The probe is invisible, takes no space, and is only ever written
 * from the ticker, never from the callback — which is what keeps the observer
 * clear of its "loop limit" error.
 */
export function onLateFrame(callback: () => void): () => void {
  const probe = document.createElement('div')
  probe.setAttribute('aria-hidden', 'true')
  probe.style.cssText =
    'position:fixed;left:0;top:0;height:0;width:1px;visibility:hidden;pointer-events:none;contain:strict'
  document.body.appendChild(probe)
  const observer = new ResizeObserver(() => callback())
  observer.observe(probe)
  let wide = false
  const stop = ticker.add(() => {
    wide = !wide
    probe.style.width = wide ? '2px' : '1px'
  })
  return () => {
    stop()
    observer.disconnect()
    probe.remove()
  }
}
