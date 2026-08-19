import { renderToString } from 'react-dom/server'
import type { ComponentType } from 'react'
import {
  ModulatoRoot,
  resolveEntry,
  type HeadConfig,
  type HeadLink,
  type HeadMeta,
  type HeadScript,
  type MetaResult,
  type RouteDef,
} from 'modulato'

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

/** Serialize `{ rel: 'icon', href: '/x' }` → ` rel="icon" href="/x"`. */
function attrs(obj: Record<string, string | boolean | undefined>, skip: string[] = []): string {
  let out = ''
  for (const [key, value] of Object.entries(obj)) {
    if (skip.includes(key) || value === undefined || value === false || value === null) continue
    out += value === true ? ` ${key}` : ` ${key}="${escapeHtml(String(value))}"`
  }
  return out
}

function renderLinks(links: HeadLink[] = []): string {
  return links.map((l) => `<link${attrs(l)} />\n`).join('')
}

function renderMetas(metas: HeadMeta[] = []): string {
  return metas.map((m) => `<meta${attrs(m)} />\n`).join('')
}

function renderScripts(scripts: HeadScript[] = []): string {
  return scripts
    .map((s) => `<script${attrs(s, ['children'])}>${s.children ?? ''}</script>\n`)
    .join('')
}

function htmlDocument({
  appHtml,
  meta,
  payload,
  clientSrc,
  styles = [],
  intro,
  shellIntro,
  head,
}: {
  appHtml: string
  meta: MetaResult
  payload: string
  clientSrc: string
  styles?: string[]
  intro?: boolean
  shellIntro?: boolean
  head?: HeadConfig
}): string {
  const title = meta.title ?? 'Modulato'
  const styleLinks = styles
    .map((href) => `<link rel="stylesheet" href="${escapeHtml(href)}" />\n`)
    .join('')
  // Site-wide head (favicon/manifest/fonts/default OG/analytics) first, then
  // the page's own meta()/link so a page can override site defaults.
  const siteMeta = renderMetas(head?.meta)
  const siteLinks = renderLinks(head?.link)
  const pageMeta = renderMetas(meta.meta)
  const pageLinks = renderLinks(meta.link)
  const scripts = renderScripts(head?.script) + renderScripts(meta.script)
  const lang = head?.lang ?? 'en'
  // Hides the page until the client reveals it in the same task that starts
  // the intro animations. With a shell intro (root intro.ts) the whole app is
  // hidden so the persistent shell can be choreographed in too. <noscript>
  // guarantees content is never invisible when JS is off.
  const hideSelector = shellIntro ? '#__modulato' : '[data-modulato-outlet]'
  const introStyle = intro
    ? `<style id="__modulato-intro">${hideSelector}{visibility:hidden}</style>\n<noscript><style>${hideSelector}{visibility:visible !important}</style></noscript>\n`
    : ''
  return `<!doctype html>
<html lang="${escapeHtml(lang)}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
${meta.description ? `<meta name="description" content="${escapeHtml(meta.description)}" />\n` : ''}${siteMeta}${pageMeta}${siteLinks}${pageLinks}${styleLinks}${scripts}${introStyle}<script type="application/json" id="__MODULATO_DATA__">${payload}</script>
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
  head,
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
  /** Site-wide <head> tags from modulato.config.ts. */
  head?: HeadConfig
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
        meta: { title: '404 — Not found' },
        payload: '{}',
        clientSrc,
        styles,
        head,
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
      meta: entry.meta,
      payload,
      clientSrc,
      styles,
      intro,
      shellIntro,
      head,
    }),
    status: 200,
    routeId: entry.routeId,
  }
}
