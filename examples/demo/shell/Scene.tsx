import { useRef } from 'react'
import { resolveTokens, useNavigation, useScroll, useTicker, useViewport } from 'modulato'
import tokens from '../motion'

/**
 * The "any custom component" proof: a persistent 2D-canvas square driven
 * entirely by framework hooks — an r3f scene would consume the exact same
 * surface (swap the canvas draw for meshes):
 *
 *   - useScroll   → rotates with the ACTIVE page's smooth scroll (the shell
 *                   subscription survives navigations)
 *   - useNavigation → spins faster + scales down while a transition runs
 *   - useTicker   → one frame loop on the framework ticker, auto-cleaned
 *   - motion tokens → every number tweakable live (✦ motion), responsive,
 *                   reduced-motion aware via resolveTokens()
 */
export function Scene() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const nav = useNavigation()
  const navRef = useRef(nav)
  navRef.current = nav
  const { dpr } = useViewport()
  const state = useRef({ spin: 0, scrollTurn: 0, scale: 1 })

  useScroll((e) => {
    state.current.scrollTurn = e.progress * Math.PI * 2
  })

  useTicker((_, delta) => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const { scene } = resolveTokens(tokens)
    const transitioning = navRef.current.phase !== 'idle'
    const s = state.current
    s.spin += (delta / 1000) * scene.spin * (transitioning ? scene.boost : 1)
    s.scale += ((transitioning ? scene.shrink : 1) - s.scale) * 0.08

    const size = canvas.width
    ctx.clearRect(0, 0, size, size)
    ctx.save()
    ctx.translate(size / 2, size / 2)
    ctx.rotate(s.spin + s.scrollTurn)
    ctx.scale(s.scale, s.scale)
    const half = size * 0.28
    ctx.lineWidth = 2 * dpr
    ctx.strokeStyle = getComputedStyle(canvas).color
    ctx.strokeRect(-half, -half, half * 2, half * 2)
    ctx.restore()
  })

  const px = Math.max(1, dpr) * 96
  return <canvas ref={canvasRef} className="scene" width={px} height={px} aria-hidden="true" />
}
