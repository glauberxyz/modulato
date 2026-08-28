import { DEV } from './dev'
import { createTokenRegistry } from './registry'

/**
 * Motion tokens: the tweakable numbers of an animation, colocated with the
 * page in `motion.ts`. Tokens are DATA, not code — that's what lets Tweak
 * Mode edit them live and save them back into the source file.
 *
 *   // pages/home/motion.ts
 *   export default motion({
 *     intro: { headline: { duration: 1.1, stagger: 0.1, ease: 'expo.out' } },
 *   })
 *
 * In dev, every motion.ts registers itself (via a build-time transform) into
 * the registry below; the Tweak overlay and window.__MODULATO__ read from it.
 * In production this is a plain identity function — zero cost.
 */
export function motion<T extends Record<string, unknown>>(tokens: T): T {
  return tokens
}

export type { TokenLeaf, TokenValue } from './registry'

/**
 * Dev-only motion-token registry — what the Tweak overlay, window.__MODULATO__
 * and @modulato/mcp operate on. Edits mutate the live token objects, so
 * replayed animations pick them up immediately; `dirty()` diffs against the
 * file's last-known contents for Save. See ./registry for the mechanics.
 */
export const motionRegistry = createTokenRegistry()

/**
 * Called by the @modulato/vite dev transform when a motion.ts evaluates
 * (first load AND every HMR re-evaluation).
 */
export function __registerMotion(file: string, tokens: unknown, keywords?: unknown): void {
  if (!DEV || typeof window === 'undefined') return
  motionRegistry.register(file, tokens, keywords)
}

let speed = 1

/** Slow-mo for everything: GSAP via timeScale (glue listens), WAAPI directly. */
export function setMotionSpeed(value: number): void {
  speed = value
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('modulato:speed', { detail: value }))
  for (const animation of document.getAnimations()) animation.playbackRate = value
}

export function getMotionSpeed(): number {
  return speed
}

/** Apply the current speed to WAAPI animations that just started. */
export function syncWaapiSpeed(): void {
  if (!DEV || speed === 1 || typeof document === 'undefined') return
  for (const animation of document.getAnimations()) animation.playbackRate = speed
}

/** Ask every useMotion() on the page to revert and re-create its animations. */
export function replayMotions(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event('modulato:replay-motions'))
}
