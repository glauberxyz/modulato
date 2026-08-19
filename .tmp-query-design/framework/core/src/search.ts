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

/** Notify every query reader the URL changed (after a shallow write). */
export function notifySearchChange(): void {
  for (const listener of listeners) listener()
}

// Back/forward changes the query too. ONE listener for the whole store, not one
// per subscriber: `useRoute()` reads the query now, and it is called from every
// shell component that cares about the route.
let bound = false

function subscribe(callback: () => void): () => void {
  listeners.add(callback)
  if (!bound) {
    window.addEventListener('popstate', notifySearchChange)
    bound = true
  }
  // React only ever runs `subscribe` from an effect — i.e. after the commit
  // that hydrated the server's HTML. That is the earliest moment at which
  // reading the real URL can no longer contradict what was rendered, so it is
  // a safe place to open the gate for a tree that never mounts <ModulatoRoot>
  // (a test, an embedded widget). <ModulatoRoot> opens it a phase earlier.
  openQuery()
  return () => {
    listeners.delete(callback)
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
  // The same snapshot `useSearchParams()` and `useRoute().query` read, so the
  // three can never disagree about the same URL inside one render.
  const value = useSearchParams()[key] ?? null
  const set = useCallback(
    (next: string | null, opts?: SetSearchParamOptions) => setSearchParam(key, next, opts),
    [key],
  )
  return [value, set]
}

// ————— The query, as ONE live value —————
//
// Every query reader in the framework comes through here — `useSearchParam`,
// `useSearchParams` and `RouteInfo.query` — so they cannot disagree inside a
// render.
//
// PULL, NOT PUSH. Nothing is snapshotted at navigation time. `setSearchParam`
// writes history WITHOUT re-resolving the entry (that is the whole point:
// overlays keep their page, its scroll and its canvases), so a copy taken when
// the entry was built is wrong from the first shallow write — and a stale
// object that looks authoritative is worse than no object at all. Reading
// `location.search` on every access, cached on the string itself, is current by
// construction; the listener set exists to trigger RE-RENDERS, not to keep a
// value alive.
const EMPTY_QUERY: Readonly<Record<string, string>> = Object.freeze(
  Object.create(null) as Record<string, string>,
)
let cachedSearch: string | null = null
let cachedQuery: Readonly<Record<string, string>> = EMPTY_QUERY

// The hydration gate. The server has no location, so everything it renders
// carries an empty query, and the client's FIRST render has to agree with that
// HTML or React throws the tree away. `useSyncExternalStore` solves this per
// hook via getServerSnapshot — but `RouteInfo.query` is also readable straight
// off a route object (`usePage().route`, enhancers, transitions), so the gate
// lives in the store rather than in each hook. One consequence is worth the
// line: the SAME function then serves as both snapshots, and two functions that
// are one function cannot drift apart.
let open = false

/** Open the hydration gate: from here on `query` is the live URL. Idempotent. */
export function openQuery(): void {
  if (open || typeof window === 'undefined') return
  open = true
  // Anything already committed against the empty answer re-renders now.
  notifySearchChange()
}

/**
 * The whole query, parsed and frozen. `{}` on the server and until hydration
 * commits; the live `location.search` after that — including immediately after
 * `setSearchParam`, which never re-resolves the route.
 *
 * The returned object keeps its identity until the search string actually
 * changes: `useSyncExternalStore` compares snapshots with `Object.is`, and a
 * fresh object per call is an infinite render loop.
 */
export function getQuery(): Readonly<Record<string, string>> {
  if (!open) return EMPTY_QUERY
  const search = window.location.search
  if (search !== cachedSearch) {
    cachedSearch = search
    const next = Object.create(null) as Record<string, string>
    // First value wins, so a repeated key reads the same here as through
    // `URLSearchParams.get()`. The null prototype keeps `?__proto__=x` and
    // `?constructor=y` ordinary keys instead of surprises.
    for (const [key, value] of new URLSearchParams(search)) next[key] ??= value
    cachedQuery = Object.freeze(next)
  }
  return cachedQuery
}

/**
 * The whole query, reactive to the same shallow writes and Back/Forward as
 * `useSearchParam`. Read it in render — no trip to `location.search`:
 *
 *   const { preset = 'magazine', tab } = useSearchParams()
 *
 * `{}` on the server and during hydration — the same contract as
 * `useSearchParam` returning null there, and for the same reason: the query is
 * client state, never part of the SSR'd HTML, so a deep-linked overlay opens
 * (and animates) after hydration instead of mismatching. Seed `useState` from
 * it and you get the server's value forever; react to it in an effect.
 *
 * Repeated keys keep the first value (`?tag=a&tag=b` → `{ tag: 'a' }`).
 */
export function useSearchParams(): Readonly<Record<string, string>> {
  // `getQuery` for BOTH snapshots — see the gate above.
  return useSyncExternalStore(subscribe, getQuery, getQuery)
}
