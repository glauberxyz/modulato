/**
 * The dev-time token store, factored out so motion and typography can each
 * have one.
 *
 * A "token file" is any module whose default export is plain data —
 * `motion.ts`, a `*.motion.ts`, `type.ts`. This holds the live object every
 * consumer already has by reference, plus a snapshot of what is on disk, and
 * that pair is what Tweak Mode is: edits mutate the live object (so the page
 * changes now), and `dirty()` diffs against the snapshot (so Save knows what
 * to write and Reset knows what to undo).
 *
 * There is nothing motion- or type-specific below. Both registries are
 * instances of this, and both are written back by the same middleware.
 */

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
  /** Search terms per group, from the file's optional `keywords` export. */
  keywords: Record<string, string[]>
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

/**
 * The object at `path`, creating plain objects for any missing segment.
 *
 * Creation exists for ONE caller: a per-selector typography override, which
 * is a key nobody wrote yet (`overrides['.home__headline']`). It is not the
 * overlay inventing structure — the path is fully specified by the edit, and
 * the same path is what the writeback puts in the file. Returns null if a
 * segment exists and is not an object, since overwriting a real value with a
 * container would silently destroy it.
 */
function ensureAt(node: unknown, path: string[]): Record<string, unknown> | null {
  let current = node
  for (const key of path) {
    if (!current || typeof current !== 'object' || Array.isArray(current)) return null
    const parent = current as Record<string, unknown>
    const next = parent[key]
    if (next === undefined) parent[key] = {}
    else if (isLeaf(next) || Array.isArray(next)) return null
    current = parent[key]
  }
  return current && typeof current === 'object'
    ? (current as Record<string, unknown>)
    : null
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
 * A token file may export `keywords` beside its default: a map from a dotted
 * group path to the words someone would search for to find it.
 *
 *     export const keywords = { 'flight.enter.lede': ['subtitle', 'main copy'] }
 *
 * A group is named for what it IS in the code and people search for what it
 * DOES on the page — "main description" is the chapter lede, governed by
 * `flight.enter.lede`, and no substring of that query reaches it. The overlay
 * indexes these; it never shows them.
 *
 * A separate EXPORT rather than a key inside `motion({...})`: the token tree is
 * numbers-and-eases, `resolveTokens` hands it straight to animation code, and a
 * `keywords` key would become a row in the panel, widen the resolved type, and
 * need special-casing at every consumer.
 */
function normalizeKeywords(input: unknown): Record<string, string[]> {
  if (!input || typeof input !== 'object') return {}
  const out: Record<string, string[]> = {}
  for (const [path, words] of Object.entries(input as Record<string, unknown>)) {
    if (Array.isArray(words)) out[path] = words.filter((w): w is string => typeof w === 'string')
    else if (typeof words === 'string') out[path] = [words]
  }
  return out
}

export interface TokenRegistry {
  readonly version: number
  register(file: string, tokens: unknown, keywords?: unknown): void
  list(): { file: string; tokens: Record<string, unknown> }[]
  leaves(file: string): TokenLeaf[]
  keywords(file: string): Record<string, string[]>
  set(file: string, path: string[], value: TokenValue): void
  dirty(file: string): TokenLeaf[]
  reset(file: string): void
  resetLeaf(file: string, path: string[]): void
  markSaved(file: string): void
  subscribe(listener: () => void): () => void
}

export function createTokenRegistry(): TokenRegistry {
  const registry = new Map<string, TokenEntry>()
  const listeners = new Set<() => void>()
  let version = 0

  const emit = () => {
    version += 1
    for (const listener of listeners) listener()
  }

  return {
    get version() {
      return version
    },
    /**
     * Called when a token file evaluates — first load AND every HMR
     * re-evaluation. Re-registration merges into the existing live object IN
     * PLACE, because consumers hold that object by reference: that is what
     * lets an edit in the editor reach an already-mounted animation, or an
     * already-painted stylesheet, without a reload.
     */
    register(file, tokens, keywords) {
      if (!tokens || typeof tokens !== 'object') return
      const words = normalizeKeywords(keywords)
      const existing = registry.get(file)
      if (existing) {
        if (existing.tokens !== tokens) {
          assignInPlace(existing.tokens, tokens as Record<string, unknown>)
          existing.original = clone(tokens) as Record<string, unknown>
        }
        existing.keywords = words
        emit()
        return
      }
      registry.set(file, {
        file,
        tokens: tokens as Record<string, unknown>,
        original: clone(tokens) as Record<string, unknown>,
        keywords: words,
      })
      emit()
    },
    list() {
      return [...registry.values()].map(({ file, tokens }) => ({ file, tokens }))
    },
    leaves(file) {
      const entry = registry.get(file)
      return entry ? collectLeaves(entry.tokens) : []
    },
    /** Search terms per dotted group path — see `normalizeKeywords`. */
    keywords(file) {
      return registry.get(file)?.keywords ?? {}
    },
    set(file, path, value) {
      const entry = registry.get(file)
      if (!entry || !path.length) return
      const parent = ensureAt(entry.tokens, path.slice(0, -1))
      if (!parent) return
      parent[path[path.length - 1]] = value
      emit()
    },
    /** Leaves whose live value differs from the file's last-known contents. */
    dirty(file) {
      const entry = registry.get(file)
      if (!entry) return []
      return collectLeaves(entry.tokens).filter(
        ({ path, value }) => getAt(entry.original, path) !== value,
      )
    },
    reset(file) {
      const entry = registry.get(file)
      if (!entry) return
      assignInPlace(entry.tokens, clone(entry.original))
      emit()
    },
    /** Reset ONE leaf to the file's last-known value (undo a stray drag). */
    resetLeaf(file, path) {
      const entry = registry.get(file)
      if (!entry || !path.length) return
      const parent = getAt(entry.tokens, path.slice(0, -1))
      if (!parent || typeof parent !== 'object') return
      const key = path[path.length - 1]
      const original = getAt(entry.original, path)
      // A leaf the file never had (a freshly-created override) resets by
      // disappearing. Leaving it at its current value would make the dot
      // un-clearable and carry the row into the next Save.
      if (original === undefined) delete (parent as Record<string, unknown>)[key]
      else (parent as Record<string, unknown>)[key] = original
      emit()
    },
    /** After a successful save, the live state becomes the new baseline. */
    markSaved(file) {
      const entry = registry.get(file)
      if (!entry) return
      entry.original = clone(entry.tokens)
      emit()
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}
