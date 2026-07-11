import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'

const require = createRequire(import.meta.url)

function resolvable(dep) {
  try {
    require.resolve(dep)
    return true
  } catch {
    return false
  }
}

const VIRTUAL = {
  manifest: 'virtual:modulato/manifest',
  transitions: 'virtual:modulato/transitions',
  intros: 'virtual:modulato/intros',
  behaviors: 'virtual:modulato/behaviors',
  app: 'virtual:modulato/app',
  clientEntry: 'virtual:modulato/client-entry',
  serverEntry: 'virtual:modulato/server-entry',
}

/**
 * The Modulato Vite plugin.
 *
 * - Scans `pages/` and generates the route manifest (virtual module) for both
 *   server and client — routes are never registered by hand.
 * - Serves SSR HTML in dev via middleware (no separate server process).
 * - Auto-imports each page's sibling `styles.scss`.
 *
 * @param {{ pagesDir?: string }} [options]
 * @returns {import('vite').Plugin}
 */
export default function modulato(options = {}) {
  /** @type {string} */ let root
  /** @type {string} */ let pagesDir
  /** @type {string} */ let transitionsDir
  /** @type {string} */ let behaviorsDir
  let isSsrBuild = false

  return {
    name: 'modulato',

    config(_userConfig, env) {
      const base = {
        appType: 'custom',
        resolve: { dedupe: ['react', 'react-dom'] },
        ssr: { noExternal: ['modulato', '@modulato/server', '@modulato/gsap'] },
        optimizeDeps: {
          include: [
            'react',
            'react-dom/client',
            'react/jsx-runtime',
            'react/jsx-dev-runtime',
            // Reached via dynamic imports (intro files, the core's lazy Lenis)
            // that the dep scanner misses — pre-bundle to avoid a mid-session
            // "new dependencies discovered" reload.
            ...['gsap', 'gsap/SplitText', 'lenis'].filter(resolvable),
          ],
          exclude: ['modulato', '@modulato/server', '@modulato/gsap'],
        },
      }
      if (env.command !== 'build') return base

      // Production is two passes (`vite build && vite build --ssr`):
      //   1. client — hashed assets + manifest into dist/client
      //   2. ssr    — a fully-bundled (noExternal) server module into
      //               dist/server, with the client's hashed asset URLs baked
      //               into the server entry (the manifest exists by then).
      if (env.isSsrBuild) {
        return {
          ...base,
          ssr: { noExternal: true },
          build: {
            ssr: true,
            outDir: 'dist/server',
            emptyOutDir: true,
            rollupOptions: { input: { server: VIRTUAL.serverEntry } },
          },
        }
      }
      return {
        ...base,
        build: {
          manifest: true,
          outDir: 'dist/client',
          emptyOutDir: true,
          rollupOptions: { input: { app: VIRTUAL.clientEntry } },
        },
      }
    },

    configResolved(config) {
      root = config.root
      pagesDir = path.resolve(root, options.pagesDir ?? 'pages')
      transitionsDir = path.resolve(root, options.transitionsDir ?? 'transitions')
      behaviorsDir = path.resolve(root, options.behaviorsDir ?? 'behaviors')
      isSsrBuild = config.command === 'build' && !!config.build.ssr
    },

    resolveId(id) {
      if (id === VIRTUAL.app) {
        const userApp = path.resolve(root, 'app.tsx')
        return fs.existsSync(userApp) ? userApp : id
      }
      if (Object.values(VIRTUAL).includes(id)) return id
      return undefined
    },

    load(id) {
      if (id === VIRTUAL.manifest) return generateManifest(pagesDir)
      if (id === VIRTUAL.transitions) return generateTransitions(transitionsDir)
      if (id === VIRTUAL.intros) return generateIntros(pagesDir, root)
      if (id === VIRTUAL.behaviors) return generateBehaviors(behaviorsDir)
      if (id === VIRTUAL.app)
        return [
          `import { createElement } from 'react'`,
          `import { PageOutlet } from 'modulato'`,
          `export default function App() { return createElement(PageOutlet) }`,
        ].join('\n')
      if (id === VIRTUAL.clientEntry)
        return [
          `import { boot } from 'modulato/client'`,
          `import { routes } from '${VIRTUAL.manifest}'`,
          `import * as transitions from '${VIRTUAL.transitions}'`,
          `import * as intros from '${VIRTUAL.intros}'`,
          `import * as behaviors from '${VIRTUAL.behaviors}'`,
          `import App from '${VIRTUAL.app}'`,
          `boot({ routes, App, transitions, intros, behaviors })`,
        ].join('\n')
      if (id === VIRTUAL.serverEntry) {
        const flags = `intro: ${options.intro !== false}, shellIntro: ${options.intro !== false && fs.existsSync(path.resolve(root, 'intro.ts'))}`
        // Production: the client build ran first — bake its hashed asset URLs
        // (entry script + every stylesheet) into the server module.
        const assets = isSsrBuild ? clientAssets(root) : null
        const assetArgs = assets
          ? `, clientSrc: ${JSON.stringify(assets.entry)}, styles: ${JSON.stringify(assets.styles)}`
          : ''
        return [
          `import { render } from '@modulato/server'`,
          `import { routes } from '${VIRTUAL.manifest}'`,
          `import App from '${VIRTUAL.app}'`,
          `export const handle = (url) => render({ url, routes, App, ${flags}${assetArgs} })`,
        ].join('\n')
      }
      return undefined
    },

    // After the SSR build lands, emit Vercel Build Output API v3 when
    // building on Vercel (VERCEL=1) or when opted in via { vercel: true }.
    // Deploy with `vercel deploy --prebuilt`.
    writeBundle() {
      if (!isSsrBuild) return
      if (!process.env.VERCEL && !options.vercel) return
      emitVercelOutput(root)
      this.info(`emitted .vercel/output (Build Output API v3)`)
    },

    transform(code, id) {
      // Auto-import a page's sibling styles.scss.
      const file = id.split('?')[0]
      if (!file.startsWith(pagesDir) || !file.endsWith(`${path.sep}page.tsx`)) return undefined
      const styles = path.join(path.dirname(file), 'styles.scss')
      if (!fs.existsSync(styles)) return undefined
      return { code: `import ${JSON.stringify(styles)}\n${code}`, map: null }
    },

    configureServer(server) {
      // New/removed pages, transitions, intros or behaviors invalidate their
      // manifest. The root intro.ts also invalidates the server entry (its
      // presence decides how much of the app the intro hide-style covers).
      const onFileChange = (file) => {
        const virtualIds = file.startsWith(pagesDir)
          ? [VIRTUAL.manifest, VIRTUAL.intros]
          : file.startsWith(transitionsDir)
            ? [VIRTUAL.transitions]
            : file.startsWith(behaviorsDir)
              ? [VIRTUAL.behaviors]
              : file === path.resolve(root, 'intro.ts')
                ? [VIRTUAL.intros, VIRTUAL.serverEntry]
                : []
        if (!virtualIds.length) return
        for (const id of virtualIds) {
          const mod = server.moduleGraph.getModuleById(id)
          if (mod) server.moduleGraph.invalidateModule(mod)
        }
        server.ws.send({ type: 'full-reload' })
      }
      server.watcher.on('add', onFileChange)
      server.watcher.on('unlink', onFileChange)

      // SSR middleware, mounted after Vite's own (assets, HMR, transforms).
      return () => {
        server.middlewares.use(async (req, res, next) => {
          try {
            if (req.method !== 'GET') return next()
            if (!(req.headers.accept ?? '').includes('text/html')) return next()
            const url = req.originalUrl ?? req.url ?? '/'
            const entry = await server.ssrLoadModule(VIRTUAL.serverEntry)
            const { html, status, routeId } = await entry.handle(url)

            // Inline the rendered page's CSS into the SSR head. In dev, Vite
            // ships CSS through JS modules, so without this the first paint
            // is unstyled (FOUC) until the client bundle loads. Prod builds
            // emit real stylesheets instead.
            let withCss = html
            if (routeId !== undefined) {
              const css = await collectDevCss(server, [
                path.resolve(root, 'app.tsx'),
                path.join(pagesDir, routeId, 'page.tsx'),
              ])
              if (css) withCss = html.replace('</head>', `${css}</head>`)
            }

            const transformed = await server.transformIndexHtml(url, withCss)
            res.statusCode = status
            res.setHeader('Content-Type', 'text/html; charset=utf-8')
            res.end(transformed)
          } catch (error) {
            server.ssrFixStacktrace?.(error)
            next(error)
          }
        })
      }
    },
  }
}

/** Scan pagesDir for folders containing page.tsx and emit the route manifest. */
function generateManifest(pagesDir) {
  const routes = []
  const walk = (dir, prefix) => {
    if (!fs.existsSync(dir)) return
    for (const dirent of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!dirent.isDirectory()) continue
      const id = prefix ? `${prefix}/${dirent.name}` : dirent.name
      const abs = path.join(dir, dirent.name)
      if (fs.existsSync(path.join(abs, 'page.tsx'))) {
        routes.push({ id, hasConfig: fs.existsSync(path.join(abs, 'config.ts')) })
      }
      walk(abs, id)
    }
  }
  walk(pagesDir, '')

  const entries = routes.map((route) => {
    const base = `/pages/${route.id}`
    const config = route.hasConfig
      ? `, config: () => import(${JSON.stringify(`${base}/config.ts`)})`
      : ''
    return `  { id: ${JSON.stringify(route.id)}, page: () => import(${JSON.stringify(`${base}/page.tsx`)})${config} },`
  })
  return `export const routes = [\n${entries.join('\n')}\n]\n`
}

/**
 * Scan transitionsDir for pair files and emit the transitions manifest.
 * Naming: `<from>__<to>.ts` where `.` encodes `/` in nested route ids —
 * e.g. `work__work.[slug].ts` matches work → work/[slug]. `default.ts` is
 * the fallback for unmatched pairs.
 */
function generateTransitions(transitionsDir) {
  const entries = []
  let hasDefault = false
  if (fs.existsSync(transitionsDir)) {
    for (const file of fs.readdirSync(transitionsDir)) {
      if (!file.endsWith('.ts')) continue
      const name = file.slice(0, -3)
      if (name === 'default') {
        hasDefault = true
        continue
      }
      const parts = name.split('__')
      if (parts.length !== 2) continue
      entries.push({ from: decodeRouteId(parts[0]), to: decodeRouteId(parts[1]), file })
    }
  }
  const lines = entries.map(
    (e) =>
      `  { from: ${JSON.stringify(e.from)}, to: ${JSON.stringify(e.to)}, load: () => import(${JSON.stringify(`/transitions/${e.file}`)}) },`,
  )
  const fallback = hasDefault ? `() => import('/transitions/default.ts')` : 'null'
  return `export const entries = [\n${lines.join('\n')}\n]\nexport const fallback = ${fallback}\n`
}

/** `work.[slug]` → `work/[slug]` — dots encode path separators in filenames. */
function decodeRouteId(encoded) {
  return encoded.replaceAll('.', '/')
}

/**
 * Walk the dev-server module graph from the given entry files and inline
 * every reachable stylesheet as a <style> block (SvelteKit-style dev CSS
 * collection). The SSR render has already loaded these modules, so the graph
 * is populated even on the very first request.
 */
async function collectDevCss(server, entryFiles) {
  const seen = new Set()
  const cssUrls = []
  const walk = (mod) => {
    if (!mod || seen.has(mod)) return
    seen.add(mod)
    if (mod.file && /\.(css|scss|sass|less|styl)$/.test(mod.file)) cssUrls.push(mod.url)
    for (const dep of mod.importedModules) walk(dep)
  }
  for (const file of entryFiles) {
    const mods = server.moduleGraph.getModulesByFile(file)
    if (mods) for (const mod of mods) walk(mod)
  }
  let out = ''
  for (const url of cssUrls) {
    try {
      const direct = url.includes('?') ? `${url}&direct` : `${url}?direct`
      const result = await server.transformRequest(direct)
      if (result?.code)
        out += `<style data-modulato-dev-css=${JSON.stringify(url)}>\n${result.code}\n</style>\n`
    } catch {
      /* stylesheet failed to compile — the CSS error overlay will surface it */
    }
  }
  return out
}

/**
 * Scan pagesDir for intro.ts files and emit the intros manifest. A root
 * intro.ts (next to app.tsx) becomes the shell intro — first-load
 * choreography for the persistent shell, run alongside the page intro.
 */
function generateIntros(pagesDir, root) {
  const entries = []
  const walk = (dir, prefix) => {
    if (!fs.existsSync(dir)) return
    for (const dirent of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!dirent.isDirectory()) continue
      const id = prefix ? `${prefix}/${dirent.name}` : dirent.name
      const abs = path.join(dir, dirent.name)
      if (fs.existsSync(path.join(abs, 'intro.ts'))) entries.push(id)
      walk(abs, id)
    }
  }
  walk(pagesDir, '')
  const lines = entries.map(
    (id) =>
      `  { id: ${JSON.stringify(id)}, load: () => import(${JSON.stringify(`/pages/${id}/intro.ts`)}) },`,
  )
  const shell = fs.existsSync(path.resolve(root, 'intro.ts'))
    ? `() => import('/intro.ts')`
    : 'null'
  return `export const entries = [\n${lines.join('\n')}\n]\nexport const shell = ${shell}\n`
}

/**
 * Read the client build's manifest and return the hashed entry script plus
 * every emitted stylesheet (page styles are scoped by convention, so linking
 * them all is safe and gives instant styled paint on any route).
 */
function clientAssets(root) {
  const manifestPath = path.join(root, 'dist/client/.vite/manifest.json')
  if (!fs.existsSync(manifestPath)) {
    throw new Error(
      '[modulato] dist/client/.vite/manifest.json not found — run the client build first (`vite build && vite build --ssr`)',
    )
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  let entry = null
  const styles = new Set()
  for (const chunk of Object.values(manifest)) {
    if (chunk.isEntry) {
      entry = `/${chunk.file}`
      for (const css of chunk.css ?? []) styles.add(`/${css}`)
    }
  }
  // Entry CSS first (global styles), then page-level styles.
  for (const chunk of Object.values(manifest)) {
    if (!chunk.isEntry) for (const css of chunk.css ?? []) styles.add(`/${css}`)
  }
  if (!entry) throw new Error('[modulato] no entry chunk in the client manifest')
  return { entry, styles: [...styles] }
}

const VERCEL_LAUNCHER = `import { handle } from './server.js'

export default async function (req, res) {
  try {
    const { html, status } = await handle(req.url ?? '/')
    res.statusCode = status
    res.setHeader('content-type', 'text/html; charset=utf-8')
    res.end(html)
  } catch (error) {
    console.error('[modulato] SSR failed', error)
    res.statusCode = 500
    res.setHeader('content-type', 'text/plain; charset=utf-8')
    res.end('Internal Server Error')
  }
}
`

/**
 * Emit Vercel Build Output API v3: the client build as static assets and the
 * bundled SSR module as one Node serverless function behind a catch-all.
 */
function emitVercelOutput(root) {
  const out = path.join(root, '.vercel/output')
  fs.rmSync(out, { recursive: true, force: true })

  fs.cpSync(path.join(root, 'dist/client'), path.join(out, 'static'), {
    recursive: true,
    filter: (src) => path.basename(src) !== '.vite',
  })

  const fn = path.join(out, 'functions/__ssr.func')
  fs.cpSync(path.join(root, 'dist/server'), fn, { recursive: true })
  fs.writeFileSync(path.join(fn, 'index.mjs'), VERCEL_LAUNCHER)
  // The SSR bundle's .js files are ESM.
  fs.writeFileSync(path.join(fn, 'package.json'), JSON.stringify({ type: 'module' }))
  fs.writeFileSync(
    path.join(fn, '.vc-config.json'),
    JSON.stringify(
      {
        runtime: 'nodejs22.x',
        handler: 'index.mjs',
        launcherType: 'Nodejs',
        shouldAddHelpers: false,
      },
      null,
      2,
    ),
  )

  fs.writeFileSync(
    path.join(out, 'config.json'),
    JSON.stringify(
      {
        version: 3,
        routes: [
          {
            src: '/assets/(.*)',
            headers: { 'cache-control': 'public, max-age=31536000, immutable' },
            continue: true,
          },
          { handle: 'filesystem' },
          { src: '/(.*)', dest: '/__ssr' },
        ],
      },
      null,
      2,
    ),
  )
}

/** Scan behaviorsDir for enhancer files and emit the behaviors manifest. */
function generateBehaviors(behaviorsDir) {
  const lines = []
  if (fs.existsSync(behaviorsDir)) {
    for (const file of fs.readdirSync(behaviorsDir)) {
      if (!file.endsWith('.ts')) continue
      lines.push(`  { load: () => import(${JSON.stringify(`/behaviors/${file}`)}) },`)
    }
  }
  return `export const entries = [\n${lines.join('\n')}\n]\n`
}
