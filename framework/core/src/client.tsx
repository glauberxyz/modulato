import { hydrateRoot } from 'react-dom/client'
import type { ComponentType } from 'react'
import { DEV } from './dev'
import type { BehaviorsManifest, EnhancerDef } from './enhance'
import { defaultIntro, resolveIntro, type IntroRunContext, type IntrosManifest } from './intro'
import {
  getMotionSpeed,
  motionRegistry,
  replayMotions,
  setMotionSpeed,
  syncWaapiSpeed,
} from './motion'
import { resolveEntry } from './resolve'
import { ModulatoRoot } from './root'
import type { TransitionsManifest } from './transitions'
import type { RouteDef } from './types'

/** Dev-mode introspection handle — see §8 of the plan. */
export interface ModulatoDevHandle {
  /** Route id of the (top-most) mounted page. */
  readonly route: string | null
  tokens: typeof motionRegistry
  speed: number
  setSpeed: (value: number) => void
  replayMotions: () => void
  replayIntro: () => Promise<void>
  replayShellIntro: () => Promise<void>
}

declare global {
  interface Window {
    __MODULATO__?: ModulatoDevHandle
  }
}

/**
 * Client bootstrap: read server-loaded props, resolve the initial entry with
 * the same key the server used, hydrate, then run the first-load intros.
 */
export async function boot({
  routes,
  App,
  transitions,
  intros,
  behaviors,
}: {
  routes: RouteDef[]
  App: ComponentType
  transitions?: TransitionsManifest
  intros?: IntrosManifest
  behaviors?: BehaviorsManifest
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

  // Behaviors are small and apply to every page — load them before hydration
  // so the initial page's enhancers run on mount.
  let enhancers: EnhancerDef[] = []
  if (behaviors?.entries.length) {
    enhancers = (await Promise.all(behaviors.entries.map((e) => e.load()))).map(
      (m) => m.default,
    )
  }

  hydrateRoot(
    container,
    <ModulatoRoot
      routes={routes}
      App={App}
      initial={{ current: entry, next: null }}
      transitions={transitions}
      enhancers={enhancers}
    />,
  )

  if (DEV) {
    const currentPage = () =>
      [
        ...document.querySelectorAll<HTMLElement>('[data-modulato-outlet] [data-page]'),
      ].pop() ?? null
    const runIntro = async (def: { run: (ctx: IntroRunContext) => Promise<void> | void } | null, element: HTMLElement, routeId: string) => {
      const ctx = {
        element,
        route: { id: routeId, path: window.location.pathname, params: {} },
      }
      const running = def ? def.run(ctx) : defaultIntro(ctx)
      syncWaapiSpeed()
      await running
    }
    window.__MODULATO__ = {
      get route() {
        return currentPage()?.dataset.page ?? null
      },
      tokens: motionRegistry,
      get speed() {
        return getMotionSpeed()
      },
      set speed(value: number) {
        setMotionSpeed(value)
      },
      setSpeed: setMotionSpeed,
      replayMotions,
      async replayIntro() {
        const el = currentPage()
        if (!el) return
        const routeId = el.dataset.page ?? ''
        const def = intros ? await resolveIntro(intros, routeId) : null
        await runIntro(def, el, routeId)
      },
      async replayShellIntro() {
        if (!intros?.shell) return
        const def = (await intros.shell()).default
        await runIntro(def, container, window.__MODULATO__?.route ?? '')
      },
    }

    // Remote control: the dev server relays POST /__modulato/replay (from
    // @modulato/mcp or any tool) over the HMR websocket.
    const hot = (import.meta as { hot?: { on: (e: string, cb: (d: never) => void) => void } })
      .hot
    hot?.on(
      'modulato:remote',
      (data: { target?: string; value?: number }) => {
        const handle = window.__MODULATO__
        if (!handle) return
        if (data.target === 'intro') void handle.replayIntro()
        else if (data.target === 'shell') void handle.replayShellIntro()
        else if (data.target === 'motions') handle.replayMotions()
        else if (data.target === 'speed' && typeof data.value === 'number')
          handle.setSpeed(data.value)
      },
    )
  }

  // ————— First-load intros —————
  // The server injected a <style> hiding the outlet (or the whole app when a
  // shell intro exists). Same discipline as transitions: the reveal — removing
  // that style tag — happens in the SAME task that starts the intro
  // animations, so the first painted frame is already animation frame zero.
  // Only the head style tag is touched (never a React-managed element), and
  // WAAPI animations don't write inline styles, so nothing races hydration.
  const hideStyle = document.getElementById('__modulato-intro')
  if (!hideStyle) return

  const pageEl = document.querySelector<HTMLElement>(
    '[data-modulato-outlet] [data-page]',
  )
  const route = { id: entry.routeId, path: entry.path, params: entry.params }
  try {
    await document.fonts.ready
    const [pageDef, shellDef] = await Promise.all([
      intros ? resolveIntro(intros, entry.routeId) : null,
      intros?.shell ? intros.shell().then((m) => m.default) : null,
    ])
    hideStyle.remove()
    const runs: Array<Promise<void> | void> = []
    if (shellDef) runs.push(shellDef.run({ element: container, route }))
    if (pageEl) {
      const ctx = { element: pageEl, route }
      runs.push(pageDef ? pageDef.run(ctx) : defaultIntro(ctx))
    }
    if (DEV) syncWaapiSpeed()
    await Promise.all(runs)
  } catch (error) {
    console.error('[modulato] intro failed', error)
  } finally {
    hideStyle.remove()
  }
}
