import { hydrateRoot } from 'react-dom/client'
import type { ComponentType } from 'react'
import { defaultIntro, resolveIntro, type IntrosManifest } from './intro'
import { resolveEntry } from './resolve'
import { ModulatoRoot } from './root'
import type { TransitionsManifest } from './transitions'
import type { RouteDef } from './types'

/**
 * Client bootstrap: read server-loaded props, resolve the initial entry with
 * the same key the server used, hydrate, then run the page's intro.
 */
export async function boot({
  routes,
  App,
  transitions,
  intros,
}: {
  routes: RouteDef[]
  App: ComponentType
  transitions?: TransitionsManifest
  intros?: IntrosManifest
}): Promise<void> {
  const container = document.getElementById('__modulato')
  if (!container) {
    console.error('[modulato] missing #__modulato container — was the page SSR-rendered?')
    return
  }
  const dataEl = document.getElementById('__MODULATO_DATA__')
  const payload = dataEl
    ? (JSON.parse(dataEl.textContent ?? '{}') as { props?: Record<string, unknown> })
    : {}

  const pathname = window.location.pathname
  const entry = await resolveEntry(routes, pathname, `${pathname}#0`, payload.props ?? {})
  if (!entry) {
    console.error(`[modulato] no route matches "${pathname}"`)
    return
  }

  hydrateRoot(
    container,
    <ModulatoRoot
      routes={routes}
      App={App}
      initial={{ current: entry, next: null }}
      transitions={transitions}
    />,
  )

  // ————— First-load intro —————
  // The server injected a <style> hiding the outlet (unless intros are
  // disabled). Same discipline as transitions: the reveal — removing that
  // style tag — happens in the SAME task that starts the intro's animations,
  // so the first painted frame of the page is already animation frame zero.
  // Only the head style tag is touched (never a React-managed element), and
  // WAAPI animations don't write inline styles, so nothing races hydration.
  const hideStyle = document.getElementById('__modulato-intro')
  if (!hideStyle) return

  const pageEl = document.querySelector<HTMLElement>(
    '[data-modulato-outlet] [data-page]',
  )
  try {
    await document.fonts.ready
    const def = intros ? await resolveIntro(intros, entry.routeId) : null
    hideStyle.remove()
    if (pageEl) {
      const ctx = {
        element: pageEl,
        route: { id: entry.routeId, path: entry.path, params: entry.params },
      }
      await (def ? def.run(ctx) : defaultIntro(ctx))
    }
  } catch (error) {
    console.error('[modulato] intro failed', error)
  } finally {
    hideStyle.remove()
  }
}
