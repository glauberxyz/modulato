/**
 * Named easing curves declared once in modulato.config.ts and usable in every
 * motion.ts. Modulato animates through two backends whose ease vocabularies
 * don't mix — GSAP tweens take a NAME, WAAPI transitions take a CSS easing —
 * so a declared curve carries both spellings:
 *
 *   eases: { swoosh: 'cubic-bezier(0.16, 1, 0.3, 1)' }
 *   →  GSAP token:       ease: 'swoosh'
 *   →  transition token: ease: 'cubic-bezier(0.16, 1, 0.3, 1)'
 *
 * A single cubic is the one shape both backends express EXACTLY (no sampled
 * approximation), which is why the config takes cubic-bezier() and nothing
 * else. `@modulato/gsap` registers each name with GSAP's CustomEase; the CSS
 * side needs no registration — it's already a valid CSS value. The Tweak
 * overlay reads this store to label both spellings with your name.
 */

/** A curve declared in modulato.config.ts. */
export interface DeclaredEase {
  /** The name authored in config — what GSAP tokens write. */
  name: string
  /** The `cubic-bezier(…)` string — what transition tokens write. */
  css: string
  /** Control points, for GSAP's CustomEase (`x1,y1,x2,y2`). */
  points: [number, number, number, number]
}

const CUBIC = /^cubic-bezier\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)$/

/**
 * Parse a `cubic-bezier(x1, y1, x2, y2)` declaration. Returns null when the
 * string isn't a cubic or x1/x2 fall outside 0–1 (CSS rejects those outright,
 * and `element.animate()` throws rather than degrading) — callers warn.
 */
export function parseDeclaredEase(name: string, value: string): DeclaredEase | null {
  const match = CUBIC.exec(value.trim())
  if (!match) return null
  const points = match.slice(1, 5).map(Number) as [number, number, number, number]
  if (points.some((n) => Number.isNaN(n))) return null
  if (points[0] < 0 || points[0] > 1 || points[2] < 0 || points[2] > 1) return null
  return { name, css: `cubic-bezier(${points.join(', ')})`, points }
}

let declared: DeclaredEase[] = []
const listeners = new Set<(eases: DeclaredEase[]) => void>()

/** Wire the store to the configured eases. Called once by boot(). */
export function initEases(configured?: Record<string, string> | null): void {
  declared = Object.entries(configured ?? {}).flatMap(([name, value]) => {
    const ease = parseDeclaredEase(name, value)
    if (!ease)
      console.warn(
        `[modulato] ignoring ease "${name}": expected cubic-bezier(x1, y1, x2, y2) with x1/x2 in 0–1, got ${JSON.stringify(value)}`,
      )
    return ease ? [ease] : []
  })
  for (const listener of listeners) listener(declared)
}

export const easeRegistry = {
  /** Every curve declared in modulato.config.ts (empty when none are). */
  list(): DeclaredEase[] {
    return declared
  },
  /** Look one up by its config name. */
  get(name: string): DeclaredEase | undefined {
    return declared.find((e) => e.name === name)
  },
  /**
   * Run `listener` with the declared curves — NOW with whatever is known, and
   * again when boot() initializes them. Import order decides which fires
   * first: a shell component pulling in @modulato/gsap is evaluated before
   * boot() runs, a lazily-imported page after it. Backends register through
   * this so neither order loses the curves.
   */
  subscribe(listener: (eases: DeclaredEase[]) => void): () => void {
    listeners.add(listener)
    listener(declared)
    return () => listeners.delete(listener)
  },
}
