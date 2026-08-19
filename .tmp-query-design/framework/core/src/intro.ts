import type { RouteInfo } from './types'

export interface IntroRunContext {
  /** The page's root element. */
  element: HTMLElement
  route: RouteInfo
}

export interface IntroDef {
  run: (ctx: IntroRunContext) => Promise<void> | void
}

/** Identity helper for typed intro files: `export default intro({...})` */
export function intro(def: IntroDef): IntroDef {
  return def
}

export interface IntroEntry {
  id: string
  load: () => Promise<{ default: IntroDef }>
}

export interface IntrosManifest {
  entries: IntroEntry[]
  /**
   * Root `intro.ts` (next to app.tsx): first-load choreography for the
   * persistent shell (menu, marker, canvas). Runs alongside the page intro.
   */
  shell?: (() => Promise<{ default: IntroDef }>) | null
}

export async function resolveIntro(
  manifest: IntrosManifest,
  routeId: string,
): Promise<IntroDef | null> {
  const entry = manifest.entries.find((e) => e.id === routeId)
  return entry ? (await entry.load()).default : null
}

/** Built-in default intro: a simple fade-in of the page. */
export async function defaultIntro({ element }: IntroRunContext): Promise<void> {
  await element
    .animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: 500,
      easing: 'ease',
      fill: 'backwards',
    })
    .finished.catch(() => {})
}
