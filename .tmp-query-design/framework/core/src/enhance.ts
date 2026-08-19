import type { RouteInfo } from './types'

export interface EnhancerContext {
  /** The matched element. */
  element: HTMLElement
  /** Its data-* attributes (`data-reveal-delay` → `data.revealDelay`). */
  data: DOMStringMap
  /** The page the element lives in. */
  page: { element: HTMLElement; route: RouteInfo }
}

export interface EnhancerDef {
  selector: string
  setup: (ctx: EnhancerContext) => void | (() => void)
}

/**
 * Declare a behavior for HTML you don't control (CMS rich text, markdown
 * output). Files in `behaviors/` are auto-discovered; each enhancer is applied
 * to every matching node inside a page when it mounts and cleaned up when the
 * page unmounts — the same lifecycle guarantees as hooks.
 *
 *   // behaviors/reveal.ts
 *   export default enhance('[data-reveal]', ({ element }) => {
 *     const observer = new IntersectionObserver(…)
 *     return () => observer.disconnect()
 *   })
 */
export function enhance(
  selector: string,
  setup: (ctx: EnhancerContext) => void | (() => void),
): EnhancerDef {
  return { selector, setup }
}

export interface BehaviorEntry {
  load: () => Promise<{ default: EnhancerDef }>
}

export interface BehaviorsManifest {
  entries: BehaviorEntry[]
}

/** Run every enhancer against a freshly-mounted page. Returns one cleanup. */
export function applyEnhancers(
  defs: EnhancerDef[],
  pageEl: HTMLElement,
  route: RouteInfo,
): () => void {
  const cleanups: Array<() => void> = []
  for (const def of defs) {
    pageEl.querySelectorAll<HTMLElement>(def.selector).forEach((element) => {
      try {
        const cleanup = def.setup({
          element,
          data: element.dataset,
          page: { element: pageEl, route },
        })
        if (cleanup) cleanups.push(cleanup)
      } catch (error) {
        console.error(`[modulato] enhancer "${def.selector}" failed on`, element, error)
      }
    })
  }
  return () => {
    for (const cleanup of cleanups) {
      try {
        cleanup()
      } catch (error) {
        console.error('[modulato] enhancer cleanup failed', error)
      }
    }
  }
}
