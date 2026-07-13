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
    () => new URLSearchParams(window.location.search).get(key),
    () => null,
  )
  const set = useCallback(
    (next: string | null, opts?: SetSearchParamOptions) => setSearchParam(key, next, opts),
    [key],
  )
  return [value, set]
}
