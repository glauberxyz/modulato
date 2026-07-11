import { renderToString } from 'react-dom/server'
import type { ComponentType } from 'react'
import { ModulatoRoot, resolveEntry, type RouteDef } from 'modulato'

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
  intro,
}: {
  appHtml: string
  title: string
  description?: string
  payload: string
  clientSrc: string
  intro?: boolean
}): string {
  // Hides the page until the client reveals it in the same task that starts
  // the intro animations. <noscript> guarantees content is never invisible
  // when JS is off.
  const introStyle = intro
    ? `<style id="__modulato-intro">[data-modulato-outlet]{visibility:hidden}</style>\n<noscript><style>[data-modulato-outlet]{visibility:visible !important}</style></noscript>\n`
    : ''
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
${description ? `<meta name="description" content="${escapeHtml(description)}" />\n` : ''}${introStyle}<script type="application/json" id="__MODULATO_DATA__">${payload}</script>
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
  intro = true,
}: {
  url: string
  routes: RouteDef[]
  App: ComponentType
  clientSrc?: string
  /** Inject the first-load intro hiding style. Enabled by default. */
  intro?: boolean
}): Promise<RenderResult> {
  const parsed = new URL(url, 'http://modulato.internal')
  const entry = await resolveEntry(routes, parsed.pathname, `${parsed.pathname}#0`)

  if (!entry) {
    return {
      html: htmlDocument({
        appHtml: `<main style="padding:4rem;font-family:sans-serif"><h1>404</h1><p>No page matches <code>${escapeHtml(parsed.pathname)}</code>.</p></main>`,
        title: '404 — Not found',
        payload: '{}',
        clientSrc,
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
      intro,
    }),
    status: 200,
    routeId: entry.routeId,
  }
}
