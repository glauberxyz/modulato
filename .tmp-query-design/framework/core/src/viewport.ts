import { useSyncExternalStore } from 'react'
import { DEV } from './dev'

/**
 * Breakpoints are defined ONCE in modulato.config.ts and flow everywhere:
 * useViewport(), responsive token resolution, and the Tweak overlay's
 * breakpoint switcher. `desktop` is the implicit fallthrough (no query), and
 * `reduced` (prefers-reduced-motion) is always available as an override key.
 */
export const DEFAULT_BREAKPOINTS: Record<string, string> = {
  phone: '(max-width: 767px)',
  tablet: '(min-width: 768px) and (max-width: 1279px)',
}

export interface ViewportState {
  width: number
  height: number
  dpr: number
  /** Active breakpoint name — a configured one, or 'desktop'. */
  breakpoint: string
  reducedMotion: boolean
}

const SERVER_SNAPSHOT: ViewportState = {
  width: 0,
  height: 0,
  dpr: 1,
  breakpoint: 'desktop',
  reducedMotion: false,
}

let breakpoints = DEFAULT_BREAKPOINTS
let queries = new Map<string, MediaQueryList>()
let reducedQuery: MediaQueryList | null = null
let snapshot: ViewportState = SERVER_SNAPSHOT
let initialized = false

// Tweak Mode overrides (dev): preview another breakpoint without resizing.
let forcedBreakpoint: string | null = null
let forcedReduced: boolean | null = null

const listeners = new Set<() => void>()

function compute(): ViewportState {
  let active = 'desktop'
  for (const [name, query] of queries) {
    if (query.matches) {
      active = name
      break
    }
  }
  return {
    width: window.innerWidth,
    height: window.innerHeight,
    dpr: window.devicePixelRatio,
    breakpoint: forcedBreakpoint ?? active,
    reducedMotion: forcedReduced ?? reducedQuery?.matches ?? false,
  }
}

function update() {
  snapshot = compute()
  for (const listener of listeners) listener()
}

/** Wire the store to the configured breakpoints. Called once by boot(). */
export function initViewport(userBreakpoints?: Record<string, string> | null): void {
  if (typeof window === 'undefined') return
  breakpoints = userBreakpoints ?? DEFAULT_BREAKPOINTS
  queries = new Map(
    Object.entries(breakpoints).map(([name, query]) => [name, window.matchMedia(query)]),
  )
  reducedQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  for (const query of queries.values()) query.addEventListener('change', update)
  reducedQuery.addEventListener('change', update)
  window.addEventListener('resize', update)
  initialized = true
  snapshot = compute()
}

function ensureInit() {
  if (!initialized && typeof window !== 'undefined') initViewport(breakpoints)
}

export const viewportStore = {
  get(): ViewportState {
    return typeof window === 'undefined' ? SERVER_SNAPSHOT : (ensureInit(), snapshot)
  },
  subscribe(listener: () => void): () => void {
    ensureInit()
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
  breakpointNames(): string[] {
    return [...Object.keys(breakpoints), 'desktop']
  },
}

/** Dev-only (Tweak Mode): preview tokens/motions under another breakpoint. */
export function forceBreakpoint(name: string | null): void {
  if (!DEV) return
  forcedBreakpoint = name
  update()
}

export function forceReducedMotion(value: boolean | null): void {
  if (!DEV) return
  forcedReduced = value
  update()
}

export interface Viewport extends ViewportState {
  isPhone: boolean
  isTablet: boolean
  isDesktop: boolean
}

/** Reactive viewport: dimensions, active breakpoint, reduced-motion. */
export function useViewport(): Viewport {
  const state = useSyncExternalStore(
    viewportStore.subscribe,
    viewportStore.get,
    () => SERVER_SNAPSHOT,
  )
  return {
    ...state,
    isPhone: state.breakpoint === 'phone',
    isTablet: state.breakpoint === 'tablet',
    isDesktop: state.breakpoint === 'desktop',
  }
}

// ————— Responsive token resolution —————

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function deepMerge(base: Record<string, unknown>, override: Record<string, unknown>) {
  for (const [key, value] of Object.entries(override)) {
    if (isPlainObject(value) && isPlainObject(base[key])) {
      deepMerge(base[key] as Record<string, unknown>, value)
    } else {
      base[key] = value
    }
  }
}

function resolveNode(node: unknown, active: string, reduced: boolean): unknown {
  if (!isPlainObject(node)) return node
  const overrideKeys = new Set([...Object.keys(breakpoints), 'desktop', 'reduced'])
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(node)) {
    if (overrideKeys.has(key)) continue
    out[key] = resolveNode(value, active, reduced)
  }
  const activeOverride = node[active]
  if (isPlainObject(activeOverride)) deepMerge(out, activeOverride)
  if (reduced && isPlainObject(node.reduced))
    deepMerge(out, node.reduced as Record<string, unknown>)
  return out
}

/**
 * Resolve responsive motion tokens for the CURRENT viewport: any token group
 * may carry per-breakpoint override blocks, deep-merged over the base —
 * `reduced` (prefers-reduced-motion) merges last, on top of everything.
 *
 *   headline: {
 *     y: 120, duration: 1.2,
 *     phone:   { y: 40, duration: 0.8 },
 *     reduced: { duration: 0 },
 *   }
 *
 * Write the animation once, vary the numbers per breakpoint. Call it at
 * animation-run time (inside intros, transitions, useMotion) so replays and
 * breakpoint changes always read fresh values.
 */
export function resolveTokens<T>(tokens: T): T {
  const { breakpoint, reducedMotion } = viewportStore.get()
  return resolveNode(tokens, breakpoint, reducedMotion) as T
}
