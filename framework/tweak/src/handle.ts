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
