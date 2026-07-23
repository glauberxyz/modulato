import { DEV } from './dev'

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

export type TokenValue = number | string | boolean

export interface TokenLeaf {
  path: string[]
  value: TokenValue
}

interface TokenEntry {
  file: string
  /** The LIVE object every consumer holds — mutated in place on edits. */
  tokens: Record<string, unknown>
  /** Snapshot of the last saved state, for dirty-tracking and reset. */
  original: Record<string, unknown>
}

const registry = new Map<string, TokenEntry>()
const listeners = new Set<() => void>()
let version = 0

function emit() {
  version += 1
  for (const listener of listeners) listener()
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function isLeaf(value: unknown): value is TokenValue {
  return (
    typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean'
  )
}

function collectLeaves(
  node: unknown,
  path: string[] = [],
  out: TokenLeaf[] = [],
): TokenLeaf[] {
  if (isLeaf(node)) {
    out.push({ path, value: node })
    return out
  }
  if (node && typeof node === 'object' && !Array.isArray(node)) {
    for (const [key, value] of Object.entries(node)) {
      collectLeaves(value, [...path, key], out)
    }
  }
  return out
}

function getAt(node: unknown, path: string[]): unknown {
  let current = node
  for (const key of path) {
    if (!current || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[key]
  }
  return current
}

/** Copy `next`'s values into `target` without changing `target`'s identity. */
function assignInPlace(target: Record<string, unknown>, next: Record<string, unknown>) {
  for (const key of Object.keys(target)) {
    if (!(key in next)) delete target[key]
  }
  for (const [key, value] of Object.entries(next)) {
    const existing = target[key]
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      existing &&
      typeof existing === 'object' &&
      !Array.isArray(existing)
    ) {
      assignInPlace(existing as Record<string, unknown>, value as Record<string, unknown>)
    } else {
      target[key] = value
    }
  }
}

/**
 * Called by the @modulato/vite dev transform when a motion.ts evaluates
 * (first load AND every HMR re-evaluation). Re-registration merges into the
 * existing live object IN PLACE — consumers hold that object by reference,
 * so file edits reach already-mounted animations without a reload.
 */
export function __registerMotion(file: string, tokens: unknown): void {
  if (!DEV || typeof window === 'undefined') return
  if (!tokens || typeof tokens !== 'object') return
  const existing = registry.get(file)
  if (existing) {
    if (existing.tokens !== tokens) {
      assignInPlace(existing.tokens, tokens as Record<string, unknown>)
      existing.original = clone(tokens) as Record<string, unknown>
    }
    emit()
    return
  }
  registry.set(file, {
    file,
    tokens: tokens as Record<string, unknown>,
    original: clone(tokens) as Record<string, unknown>,
  })
  emit()
}

/**
 * Dev-only token registry — what the Tweak overlay, window.__MODULATO__ and
 * (later) @modulato/mcp operate on. Edits mutate the live token objects, so
 * replayed animations pick them up immediately; `dirty()` diffs against the
 * file's last-known contents for Save.
 */
export const motionRegistry = {
  get version() {
    return version
  },
  list(): { file: string; tokens: Record<string, unknown> }[] {
    return [...registry.values()].map(({ file, tokens }) => ({ file, tokens }))
  },
  leaves(file: string): TokenLeaf[] {
    const entry = registry.get(file)
    return entry ? collectLeaves(entry.tokens) : []
  },
  set(file: string, path: string[], value: TokenValue): void {
    const entry = registry.get(file)
    if (!entry || !path.length) return
    const parent = getAt(entry.tokens, path.slice(0, -1))
    if (!parent || typeof parent !== 'object') return
    ;(parent as Record<string, unknown>)[path[path.length - 1]] = value
    emit()
  },
  /** Leaves whose live value differs from the file's last-known contents. */
  dirty(file: string): TokenLeaf[] {
    const entry = registry.get(file)
    if (!entry) return []
    return collectLeaves(entry.tokens).filter(
      ({ path, value }) => getAt(entry.original, path) !== value,
    )
  },
  reset(file: string): void {
    const entry = registry.get(file)
    if (!entry) return
    assignInPlace(entry.tokens, clone(entry.original))
    emit()
  },
  /** Reset ONE leaf to the file's last-known value (undo a stray drag). */
  resetLeaf(file: string, path: string[]): void {
    const entry = registry.get(file)
    if (!entry || !path.length) return
    const original = getAt(entry.original, path)
    if (original === undefined) return
    const parent = getAt(entry.tokens, path.slice(0, -1))
    if (!parent || typeof parent !== 'object') return
    ;(parent as Record<string, unknown>)[path[path.length - 1]] = original
    emit()
  },
  /** After a successful save, the live state becomes the new baseline. */
  markSaved(file: string): void {
    const entry = registry.get(file)
    if (!entry) return
    entry.original = clone(entry.tokens)
    emit()
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
}

// ————— Playback speed (Tweak Mode slow-mo) —————

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
