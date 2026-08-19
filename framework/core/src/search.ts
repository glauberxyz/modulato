import { useCallback, useSyncExternalStore } from 'react'

/**
 * Query-string state — the primitive behind shell overlays and any UI whose
 * state belongs in the URL (`?company=aero`, `?tab=team`) rather than in a
 * route. Reading is reactive; writing is a SHALLOW history update that does
 * NOT re-resolve or remount the page (the router treats a same-pathname
 * popstate as shallow too — see root.tsx), so opening an overlay keeps the
 * page, its scroll, and its canvases exactly as they are.
 *
 *   const [company, setCompany] = useSearchParam('company')
 *   // open:  setCompany('aero')        // pushState — Back closes the overlay
 *   // close: setCompany(null)          // removes the param
 *   // swap:  setCompany('layer', { replace: true })  // no new history entry
 *
 * SSR-safe: returns null on the server, so an overlay deep-linked via the query
 * opens after hydration (open it in an effect, as overlays animate in anyway).
 */

const listeners = new Set<() => void>()

/** Notify `useSearchParam` readers the query changed (after a shallow write). */
export function notifySearchChange(): void {
  for (const listener of listeners) listener()
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback)
  // Back/forward changes the query too — react to it directly.
  window.addEventListener('popstate', callback)
  return () => {
    listeners.delete(callback)
    window.removeEventListener('popstate', callback)
  }
}

export interface SetSearchParamOptions {
  /** replaceState instead of pushState — no new history entry (Back skips it). */
  replace?: boolean
}

/** Set or clear one query param with a shallow history update (no remount). */
export function setSearchParam(
  key: string,
  value: string | null,
  opts: SetSearchParamOptions = {},
): void {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  if (value === null || value === '') url.searchParams.delete(key)
  else url.searchParams.set(key, value)
  const method = opts.replace ? 'replaceState' : 'pushState'
  window.history[method]({ ...window.history.state }, '', url.pathname + url.search + url.hash)
  notifySearchChange()
}

/**
 * Reactive read + shallow write for one query param. `value` is null when the
 * param is absent (and on the server). `set(value, { replace })` updates the
 * URL without remounting the page.
 */
export function useSearchParam(
  key: string,
): [string | null, (value: string | null, opts?: SetSearchParamOptions) => void] {
  const value = useSyncExternalStore(
    subscribe,
    // The same parse `useSearchParams` reads, so the two can never disagree
    // about one URL. The SNAPSHOT stays a string, so a component watching
    // `?tab` does not re-render when `?preset` changes.
    () => readSearchParams()[key] ?? null,
    () => null,
  )
  const set = useCallback(
    (next: string | null, opts?: SetSearchParamOptions) => setSearchParam(key, next, opts),
    [key],
  )
  return [value, set]
}

/**
 * The query, read-only.
 *
 * `string | undefined`, not `string`: this repo and the scaffold are `strict`
 * but not `noUncheckedIndexedAccess`, so a plain `Record<string, string>` would
 * type `query.preset` as a string on a page reached WITHOUT `?preset=` —
 * `query.preset.toUpperCase()` would typecheck and throw. `Readonly` for the
 * matching reason: assigning here would write to an object the URL never reads,
 * so it is a compile error rather than a silent no-op. Write with
 * `setSearchParam`.
 */
export type SearchParams = Readonly<Record<string, string | undefined>>

/**
 * A NULL-PROTOTYPE empty query, shared by every empty read.
 *
 * Shared identity matters twice. `useSyncExternalStore` compares snapshots by
 * identity, so returning the same object for the server snapshot and the first
 * client snapshot is what keeps a page with no `?` from re-rendering every
 * reader once after hydration. Frozen because it is shared: a mutation would
 * reach all of them.
 */
const EMPTY_QUERY: SearchParams = Object.freeze(Object.create(null) as Record<string, string>)

// Cache keyed on the raw search string. Parsing on every call would return a
// fresh object each time, and a snapshot that never compares equal is an
// infinite render loop — not a slow one, a hanging one.
let cachedSearch: string | null = null
let cachedQuery: SearchParams = EMPTY_QUERY

/**
 * The query in the address bar right now, for code OUTSIDE React — an event
 * handler, a transition, an intro, an enhancer — which reads it at a moment
 * rather than across renders. In render use `useSearchParams`, which subscribes.
 *
 * Empty on the server, and that guard is load-bearing rather than defensive:
 * the cache below is per-process, so this is only safe to call during
 * `renderToString` because the server branch never writes it.
 */
export function readSearchParams(): SearchParams {
  if (typeof window === 'undefined') return EMPTY_QUERY
  const search = window.location.search
  if (search !== cachedSearch) {
    cachedSearch = search
    // Null prototype, not `{}`. With a plain object `next[key] ??= value` never
    // fires for `constructor`, `toString` or `__proto__` — the INHERITED value
    // is already non-nullish — so those params vanish and `query.constructor`
    // hands back the Object function, typed as a string. `useSearchParam` goes
    // through URLSearchParams and returns them correctly, so the two reads
    // would disagree on exactly the keys someone picks deliberately.
    const next = Object.create(null) as Record<string, string>
    // First value wins, matching `URLSearchParams.get` and so `useSearchParam`.
    for (const [key, value] of new URLSearchParams(search)) next[key] ??= value
    cachedQuery = Object.keys(next).length > 0 ? Object.freeze(next) : EMPTY_QUERY
  }
  return cachedQuery
}

/**
 * The whole query, reactive to the same shallow writes and Back/Forward as
 * `useSearchParam`. Read it in render instead of reaching for
 * `location.search`:
 *
 *   const { preset = 'magazine', tab } = useSearchParams()
 *
 * A plain object, NOT a `URLSearchParams` — `query.preset`, not
 * `query.get('preset')`, which is where this differs from the hook of the same
 * name in React Router and Next. Absent keys read `undefined`; a repeated key
 * keeps the first value (`?tag=a&tag=b` → `{ tag: 'a' }`), and for every value
 * there is one line of platform: `new URLSearchParams(location.search).getAll()`.
 * The object has a null prototype, so ask `'k' in query`, not
 * `query.hasOwnProperty('k')`.
 *
 * EMPTY on the server and through the hydrating render — the same contract as
 * `useSearchParam` returning null there, and for the same reason: the query is
 * client state and never part of the SSR'd HTML, so a deep-linked overlay opens
 * after hydration instead of mismatching. A deep-linked value therefore arrives
 * one render LATE: react to it in an effect. Seed `useState` with it and you
 * capture the server's empty value and keep it forever.
 *
 * Its identity is stable until the query actually changes, so it is safe in a
 * dependency array.
 */
export function useSearchParams(): SearchParams {
  return useSyncExternalStore(subscribe, readSearchParams, () => EMPTY_QUERY)
}
