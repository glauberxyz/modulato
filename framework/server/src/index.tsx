import { renderToString } from 'react-dom/server'
import type { ComponentType } from 'react'
import { ModulatoRoot, resolveEntry, type RouteDef } from 'modulato'

export { nodeAction, ACTION_PREFIX } from './action'
export type { ActionEntry, ActionsManifest } from './action'

export interface RenderResult {
  html: string
  status: number
  /** Matched route id — lets the dev server collect this page's CSS. */
  routeId?: string
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function htmlDocument({
  appHtml,
  title,
  description,
  payload,
  clientSrc,
  styles = [],
  intro,
  shellIntro,
}: {
  appHtml: string
  title: string
  description?: string
  payload: string
  clientSrc: string
  styles?: string[]
  intro?: boolean
  shellIntro?: boolean
}): string {
  const styleLinks = styles
    .map((href) => `<link rel="stylesheet" href="${escapeHtml(href)}" />\n`)
    .join('')
  // Hides the page until the client reveals it in the same task that starts
  // the intro animations. With a shell intro (root intro.ts) the whole app is
  // hidden so the persistent shell can be choreographed in too. <noscript>
  // guarantees content is never invisible when JS is off.
  const hideSelector = shellIntro ? '#__modulato' : '[data-modulato-outlet]'
  const introStyle = intro
    ? `<style id="__modulato-intro">${hideSelector}{visibility:hidden}</style>\n<noscript><style>${hideSelector}{visibility:visible !important}</style></noscript>\n`
    : ''
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
${description ? `<meta name="description" content="${escapeHtml(description)}" />\n` : ''}${styleLinks}${introStyle}<script type="application/json" id="__MODULATO_DATA__">${payload}</script>
</head>
<body>
<div id="__modulato">${appHtml}</div>
<script type="module" src="${clientSrc}"></script>
</body>
</html>`
}

export async function render({
  url,
  routes,
  App,
  clientSrc = '/@id/virtual:modulato/client-entry',
  styles = [],
  intro = true,
  shellIntro = false,
  content = {},
}: {
  url: string
  routes: RouteDef[]
  App: ComponentType
  clientSrc?: string
  /** Built stylesheet hrefs to link in <head> (production builds). */
  styles?: string[]
  /** Inject the first-load intro hiding style. Enabled by default. */
  intro?: boolean
  /** A root intro.ts exists — hide the whole app, not just the outlet. */
  shellIntro?: boolean
  /** Content snapshot passed to page loaders. */
  content?: Record<string, unknown>
}): Promise<RenderResult> {
  const parsed = new URL(url, 'http://modulato.internal')
  const entry = await resolveEntry(
    routes,
    parsed.pathname,
    `${parsed.pathname}#0`,
    undefined,
    content,
  )

  if (!entry) {
    return {
      html: htmlDocument({
        appHtml: `<main style="padding:4rem;font-family:sans-serif"><h1>404</h1><p>No page matches <code>${escapeHtml(parsed.pathname)}</code>.</p></main>`,
        title: '404 — Not found',
        payload: '{}',
        clientSrc,
        styles,
      }),
      status: 404,
    }
  }

  const appHtml = renderToString(
    <ModulatoRoot routes={routes} App={App} initial={{ current: entry, next: null }} />,
  )
  // `<` escaped so page content can never close the JSON script tag.
  const payload = JSON.stringify({ props: entry.props }).replaceAll('<', '\\u003c')

  return {
    html: htmlDocument({
      appHtml,
      title: entry.meta.title ?? 'Modulato',
      description: entry.meta.description,
      payload,
      clientSrc,
      styles,
      intro,
      shellIntro,
    }),
    status: 200,
    routeId: entry.routeId,
  }
}
