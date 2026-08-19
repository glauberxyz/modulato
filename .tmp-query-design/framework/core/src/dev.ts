/** True in dev builds (Vite). False in prod and in non-Vite consumers. */
export const DEV: boolean =
  typeof import.meta !== 'undefined' &&
  Boolean((import.meta as { env?: { DEV?: boolean } }).env?.DEV)

const warned = new Set<string>()

/** console.warn once per unique message — contract warnings, not spam. */
export function warnOnce(message: string): void {
  if (warned.has(message)) return
  warned.add(message)
  console.warn(`[modulato] ${message}`)
}

/**
 * Contract check: `data-shared` ids must be unique within a page — duplicates
 * make FLIP matching ambiguous (first match wins, silently).
 */
export function checkDuplicateSharedIds(root: HTMLElement, routeId: string): void {
  const seen = new Set<string>()
  root.querySelectorAll<HTMLElement>('[data-shared]').forEach((el) => {
    const id = el.dataset.shared
    if (!id) return
    if (seen.has(id))
      warnOnce(
        `duplicate <Shared id="${id}"> on page "${routeId}" — shared ids must be unique per page, or FLIP matching is ambiguous.`,
      )
    seen.add(id)
  })
}
