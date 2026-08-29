import { useEffect, useState } from 'react'
import type { ModulatoDevHandle } from 'modulato/client'

/**
 * The running app's dev handle, once it exists.
 *
 * Polled rather than awaited: the overlay is mounted by the client entry's
 * own `.then()`, so on a fast machine it can render before `boot()` has
 * finished installing the handle, and on a slow one long after.
 */
export function useHandle(): ModulatoDevHandle | null {
  const [handle, setHandle] = useState<ModulatoDevHandle | null>(
    () => window.__MODULATO__ ?? null,
  )
  useEffect(() => {
    if (handle) return undefined
    const timer = setInterval(() => {
      if (window.__MODULATO__) {
        setHandle(window.__MODULATO__)
        clearInterval(timer)
      }
    }, 100)
    return () => clearInterval(timer)
  }, [handle])
  return handle
}

/**
 * The project's typography module, as the registry keys it.
 *
 * Asked rather than assumed: a site-wide token module lives in `tokens/`, but
 * the root spelling predates that folder and still works, and this same string
 * is what Save posts back to. The registry holds exactly one type file, so
 * whichever one the app registered is the answer.
 */
export function typeFile(handle: ModulatoDevHandle | null): string {
  return handle?.type?.list()[0]?.file ?? '/tokens/type.ts'
}

/** The project's palette module, as the registry keys it — see `typeFile`. */
export function colorFile(handle: ModulatoDevHandle | null): string {
  return handle?.colors?.list()[0]?.file ?? '/tokens/color.ts'
}
