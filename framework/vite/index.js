import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { transformWithEsbuild } from 'vite'

const require = createRequire(import.meta.url)

/**
 * Does this URL look like something Vite's own middleware should have served?
 *
 * Only consulted by the SSR handler, which is mounted LAST — so anything
 * reaching it that looks like an asset is an asset Vite could not find, and
 * `next()` hands it Vite's 404 rather than a page with a 200.
 */
function isAssetRequest(url) {
  const pathname = url.split('?')[0]
  if (/^\/(?:@vite|@fs|@id|@react-refresh|node_modules)\b/.test(pathname)) return true
  // An extension on the LAST segment only — /work/logo.png is an asset,
  // /v1.2/about is a route.
  return /\.[a-z0-9]+$/i.test(pathname.slice(pathname.lastIndexOf('/')))
}

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
  content: 'virtual:modulato/content',
  actions: 'virtual:modulato/actions',
  breakpoints: 'virtual:modulato/breakpoints',
  eases: 'virtual:modulato/eases',
  app: 'virtual:modulato/app',
  clientEntry: 'virtual:modulato/client-entry',
  serverEntry: 'virtual:modulato/server-entry',
  jsxDev: 'virtual:modulato/jsx-dev-runtime',
}

const CONTENT_SNAPSHOT = '.modulato/content.json'

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
  let isServe = false

  return {
    name: 'modulato',

    config(_userConfig, env) {
      const base = {
        appType: 'custom',
        // gsap is deduped too: its ease registry, plugin list and
        // globalTimeline are module-level singletons, so a second copy means
        // config-declared eases (registered by @modulato/gsap) and Tweak's
        // slow-mo silently miss the tweens an app creates with its own import.
        resolve: {
          dedupe: ['react', 'react-dom', 'gsap'],
        },
        ssr: {
          noExternal: [
            'modulato',
            '@modulato/server',
            '@modulato/gsap',
          ],
        },
        optimizeDeps: {
          include: [
            'react',
            'react-dom/client',
            'react/jsx-runtime',
            'react/jsx-dev-runtime',
            // Reached via dynamic imports (intro files, the core's lazy Lenis)
            // that the dep scanner misses — pre-bundle to avoid a mid-session
            // "new dependencies discovered" reload.
            ...['gsap', 'gsap/SplitText', 'gsap/CustomEase', 'lenis'].filter(resolvable),
            // The Tweak overlay is served from source (excluded below), so
            // the scanner never sees its transitive deps: @base-ui/react
            // reaches use-sync-external-store's CJS shims, whose conditional
            // `module.exports = require(…)` hides the named exports unless
            // the optimizer pre-bundles them with interop. Without these the
            // overlay module throws on import ("does not provide an export
            // named 'useSyncExternalStore'") and the ✦ Tweak button never
            // mounts in consuming apps.
            ...(options.tweak !== false
              ? [
                  'use-sync-external-store/shim',
                  'use-sync-external-store/shim/with-selector',
                ].filter(resolvable)
              : []),
          ],
          exclude: ['modulato', '@modulato/server', '@modulato/gsap', '@modulato/tweak'],
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
      isServe = config.command === 'serve'
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
      if (id === VIRTUAL.transitions) return generateTransitions(transitionsDir, pagesDir)
      if (id === VIRTUAL.jsxDev) return generateJsxDevRuntime(root)
      if (id === VIRTUAL.intros) return generateIntros(pagesDir, root)
      if (id === VIRTUAL.behaviors) return generateBehaviors(behaviorsDir)
      if (id === VIRTUAL.content) {
        const snapshot = path.join(root, CONTENT_SNAPSHOT)
        const json = fs.existsSync(snapshot) ? fs.readFileSync(snapshot, 'utf8') : '{}'
        return `export default ${json}\n`
      }
      if (id === VIRTUAL.actions) return generateActions(pagesDir)
      if (id === VIRTUAL.breakpoints)
        return extractConfigStringMap(root, this, 'breakpoints').then(
          (bp) => `export default ${JSON.stringify(bp)}\n`,
        )
      if (id === VIRTUAL.eases)
        return extractConfigStringMap(root, this, 'eases').then(
          (eases) => `export default ${JSON.stringify(eases)}\n`,
        )
      if (id === VIRTUAL.app)
        return [
          `import { createElement } from 'react'`,
          `import { PageOutlet } from 'modulato'`,
          `export default function App() { return createElement(PageOutlet) }`,
        ].join('\n')
      if (id === VIRTUAL.clientEntry) {
        return extractConfigStringMap(root, this, 'eases').then((declaredEases) => {
          const lines = [
            `import { boot } from 'modulato/client'`,
            `import { routes } from '${VIRTUAL.manifest}'`,
            `import * as transitions from '${VIRTUAL.transitions}'`,
            `import * as intros from '${VIRTUAL.intros}'`,
            `import * as behaviors from '${VIRTUAL.behaviors}'`,
            // A LOADER, not an import: the snapshot is only needed to run a
            // `load()` during a client navigation — the first page is
            // hydrated from props SSR already sent. Imported eagerly it sat
            // in the entry chunk, so every visitor downloaded every route's
            // content before seeing one. As a dynamic import it becomes its
            // own chunk, fetched on the first link click and cached after.
            `const content = () => import('${VIRTUAL.content}').then((m) => m.default)`,
            `import breakpoints from '${VIRTUAL.breakpoints}'`,
            `import eases from '${VIRTUAL.eases}'`,
            `import App from '${VIRTUAL.app}'`,
          ]
          // Config-declared eases only resolve in GSAP once @modulato/gsap has
          // registered them, and that module is otherwise loaded lazily — by
          // whichever page happens to import useMotion. An intro using raw
          // `gsap` on a page that doesn't would silently get quad.out. Pull the
          // registrar into the entry, but ONLY when curves are actually
          // declared, so apps that don't use them keep gsap out of the bundle.
          if (declaredEases && resolvable('@modulato/gsap'))
            lines.push(`import '@modulato/gsap'`)
          else if (declaredEases)
            // Nothing else registers them: a GSAP token naming one would
            // silently animate with quad.out.
            console.warn(
              `[modulato] modulato.config.ts declares eases (${Object.keys(declaredEases).join(', ')}) but @modulato/gsap is not installed — GSAP tokens can't use them by name. Install @modulato/gsap, or reference the cubic-bezier() value directly.`,
            )
          lines.push(
            `boot({ routes, App, transitions, intros, behaviors, content, breakpoints, eases })`,
          )
          // Tweak Mode overlay — dev only, and only when the site installed it.
          if (isServe && options.tweak !== false && resolvable('@modulato/tweak/overlay'))
            lines.push(
              `.then(() => import('@modulato/tweak/overlay')).then((m) => m.mount())`,
            )
          return lines.join('\n')
        })
      }
      if (id === VIRTUAL.serverEntry) {
        const flags = `intro: ${options.intro !== false}, shellIntro: ${options.intro !== false && fs.existsSync(path.resolve(root, 'intro.ts'))}`
        // Production: the client build ran first — bake its hashed asset URLs
        // (entry script + every stylesheet) into the server module.
        const assets = isSsrBuild ? clientAssets(root) : null
        const assetArgs = assets
          ? `, clientSrc: ${JSON.stringify(assets.entry)}, styles: ${JSON.stringify(assets.styles)}`
          : ''
        // Site-wide <head> comes from modulato.config.ts. The server runs in
        // Node, so importing the full config (incl. the node-only content
        // adapter) is safe — only its `head` field is read at render time.
        const hasConfig = fs.existsSync(path.resolve(root, 'modulato.config.ts'))
        const lines = [
          `import { render, nodeAction } from '@modulato/server'`,
          `import { routes } from '${VIRTUAL.manifest}'`,
          `import content from '${VIRTUAL.content}'`,
          `import * as actions from '${VIRTUAL.actions}'`,
          `import App from '${VIRTUAL.app}'`,
          // Re-exported so the two callers — the dev middleware below and the
          // Vercel launcher — build the request and write the headers the
          // same way, without either needing @modulato/server as a dependency
          // of its own.
          `export { nodeRequest, applyHeaders } from '@modulato/server'`,
        ]
        if (hasConfig) lines.push(`import __config from '/modulato.config.ts'`)
        const configArgs = hasConfig ? `, head: __config?.head, response: __config?.response` : ''
        lines.push(
          `export const handle = (url, request) => render({ url, request, routes, App, content${configArgs}, ${flags}${assetArgs} })`,
          `export const handleActionNode = (req, res) => nodeAction({ actions, req, res })`,
        )
        return lines.join('\n')
      }
      return undefined
    },

    // After the SSR build lands, emit Vercel Build Output API v3 when
    // building on Vercel (VERCEL=1) or when opted in via { vercel: true }.
    // Deploy with `vercel deploy --prebuilt`.
    writeBundle() {
      if (!isSsrBuild) return
      if (!process.env.VERCEL && !options.vercel) return
      const config = typeof options.vercel === 'object' ? options.vercel : {}
      emitVercelOutput(root, config, (message) => this.warn(message))
      this.info(`emitted .vercel/output (Build Output API v3)`)
    },

    transform(code, id, options) {
      const original = code
      const file = id.split('?')[0]

      // pages/**/server.ts — server actions. On the CLIENT the module is
      // replaced with URL-only stubs (handler code and secrets never ship);
      // on the SERVER the real exports are decorated with their URLs so
      // SSR-rendered forms carry a working action attribute (no-JS support).
      if (file.startsWith(pagesDir) && file.endsWith(`${path.sep}server.ts`)) {
        const route = path
          .relative(pagesDir, path.dirname(file))
          .split(path.sep)
          .join('/')
        const exports = scanActionExports(code)
        if (options?.ssr) {
          const decorations = exports
            .map(
              (name) =>
                `;Object.assign(${name}, { url: ${JSON.stringify(actionUrl(route, name))} })`,
            )
            .join('\n')
          return { code: `${code}\n${decorations}`, map: null }
        }
        const stubs = exports
          .map(
            (name) =>
              `export const ${name} = { $action: true, url: ${JSON.stringify(actionUrl(route, name))}, method: 'post' }`,
          )
          .join('\n')
        // Empty map (not null): break the sourcemap chain so the original
        // server-only source can't leak into the client via sourcesContent.
        return { code: stubs || 'export {}', map: { mappings: '' } }
      }

      // Dev: point a project file's JSX runtime at our wrapper, so each host
      // element it creates carries the file, line and column that authored it.
      //
      // Rewriting the SPECIFIER here, rather than aliasing the module, is what
      // makes it work at all: an alias is applied before dependency
      // pre-bundling and before SSR externalisation, so the wrapper's own
      // import of the real runtime came back to itself — and pointing it at an
      // absolute path instead fails, because the file is CJS and Vite's SSR
      // runner rejects that with ERR_AMBIGUOUS_MODULE_SYNTAX. Resolving by id
      // fails the other way: the client gets the pre-bundled copy and SSR gets
      // an externalised one, and neither consults a plugin. Doing it on the
      // compiled text touches only project files, leaves node_modules and the
      // wrapper alone, and reaches both environments identically.
      //
      // Requires this plugin to run AFTER the React plugin, which is the
      // documented order. If it runs first there is no `jsxDEV` import to
      // rewrite yet and the attribute is simply absent — a missing debugging
      // aid, not a broken build.
      if (
        isServe &&
        options.sourceAttribute !== false &&
        file.startsWith(root) &&
        !file.includes('node_modules') &&
        code.includes('react/jsx-dev-runtime')
      ) {
        // Only the import specifier — not the same string appearing in, say,
        // a docs page that talks about the runtime.
        //
        // Rewrite in place and fall through rather than returning: a page.tsx
        // has JSX AND needs its styles.scss injected further down, and an early
        // return here would silently drop the stylesheet in dev.
        //
        // The swap stays on its own line and shifts nothing after it, so the
        // map returned by whatever branch does return stays honest.
        code = code.replace(
          /(\bfrom\s*)(["'])react\/jsx-dev-runtime\2/g,
          (_m, from) => from + JSON.stringify(VIRTUAL.jsxDev),
        )
      }

      // Dev: every motion.ts self-registers into the token registry (Tweak
      // Mode) and self-accepts HMR — re-registration merges into the live
      // object, so file edits reach mounted animations without a reload.
      if (
        isServe &&
        file.startsWith(root) &&
        !file.includes('node_modules') &&
        (file.endsWith(`${path.sep}motion.ts`) || file.endsWith('.motion.ts'))
      ) {
        const rel = `/${path.relative(root, file).split(path.sep).join('/')}`
        return {
          code: [
            code,
            `;import { __registerMotion as __modulatoRegister } from 'modulato'`,
            `;import * as __modulatoSelf from ${JSON.stringify(rel)}`,
            // `keywords` is optional and usually absent — passing undefined
            // costs nothing, and reading it off the namespace means a file
            // gains searchability by exporting one const, with no build step
            // and nothing to keep in sync.
            `;__modulatoRegister(${JSON.stringify(rel)}, __modulatoSelf.default, __modulatoSelf.keywords)`,
            `;if (import.meta.hot) import.meta.hot.accept()`,
          ].join('\n'),
          map: null,
        }
      }

      // Auto-import a page's sibling styles.scss.
      // `undefined` means "unchanged", which would throw away a jsx-dev-runtime
      // rewrite made above. Hand back the code whenever it actually moved.
      const rewritten = code === original ? undefined : { code, map: null }
      if (!file.startsWith(pagesDir) || !file.endsWith(`${path.sep}page.tsx`)) return rewritten
      const styles = path.join(path.dirname(file), 'styles.scss')
      if (!fs.existsSync(styles)) return rewritten
      return { code: `import ${JSON.stringify(styles)}\n${code}`, map: null }
    },

    configureServer(server) {
      // New/removed pages, transitions, intros or behaviors invalidate their
      // manifest. The root intro.ts also invalidates the server entry (its
      // presence decides how much of the app the intro hide-style covers).
      const onFileChange = (file) => {
        const virtualIds = file.startsWith(pagesDir)
          ? [VIRTUAL.manifest, VIRTUAL.intros, VIRTUAL.actions]
          : file.startsWith(transitionsDir)
            ? [VIRTUAL.transitions]
            : file.startsWith(behaviorsDir)
              ? [VIRTUAL.behaviors]
              : file === path.resolve(root, 'intro.ts')
                ? [VIRTUAL.intros, VIRTUAL.serverEntry]
                : file === path.resolve(root, CONTENT_SNAPSHOT)
                  ? [VIRTUAL.content]
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

      // Re-running `modulato content` rewrites the snapshot in place, and
      // config edits change the breakpoints/eases the client derives from it.
      server.watcher.add(path.resolve(root, CONTENT_SNAPSHOT))
      server.watcher.on('change', (file) => {
        if (file === path.resolve(root, CONTENT_SNAPSHOT)) onFileChange(file)
        if (file === path.resolve(root, 'modulato.config.ts')) {
          // clientEntry too: whether it imports the ease registrar depends on
          // the config declaring any.
          for (const virtual of [VIRTUAL.breakpoints, VIRTUAL.eases, VIRTUAL.clientEntry]) {
            const mod = server.moduleGraph.getModuleById(virtual)
            if (mod) server.moduleGraph.invalidateModule(mod)
          }
          server.ws.send({ type: 'full-reload' })
        }
      })

      // Remote control (Tweak Mode / @modulato/mcp): POST /__modulato/replay
      // broadcasts to the running page over Vite's websocket — the client
      // listens and replays intros/motions or sets the playback speed.
      server.middlewares.use('/__modulato/replay', (req, res, next) => {
        if (req.method !== 'POST') return next()
        let raw = ''
        req.on('data', (chunk) => {
          raw += chunk
        })
        req.on('end', () => {
          try {
            const data = JSON.parse(raw || '{}')
            server.ws.send({ type: 'custom', event: 'modulato:remote', data })
            res.setHeader('content-type', 'application/json')
            res.end('{"ok":true}')
          } catch {
            res.statusCode = 400
            res.end('{"ok":false}')
          }
        })
      })

      // Tweak Mode writeback: POST /__modulato/tokens → AST-preserving edit
      // of a motion.ts. Dev only, and only when the site installed the tool.
      //
      // GET /__modulato/open resolves a `data-modulato-source` value to an
      // absolute path for Vite's `/__open-in-editor`, which is what turns the
      // attribute into an Option-click that lands in the editor.
      if (options.tweak !== false && resolvable('@modulato/tweak/middleware')) {
        const mount = (route, pick) => {
          let handler
          server.middlewares.use(route, (req, res, next) => {
            handler ??= import('@modulato/tweak/middleware').then((m) => pick(m)(root))
            handler.then((h) => h(req, res, next)).catch(next)
          })
        }
        mount('/__modulato/tokens', (m) => m.tokensMiddleware)
        mount('/__modulato/open', (m) => m.openMiddleware)
      }

      // SSR middleware, mounted after Vite's own (assets, HMR, transforms).
      return () => {
        server.middlewares.use(async (req, res, next) => {
          try {
            // Server actions: POST /__modulato/action/<route>__<name>.
            if (req.method === 'POST' && req.url?.startsWith('/__modulato/action/')) {
              const entry = await server.ssrLoadModule(VIRTUAL.serverEntry)
              return await entry.handleActionNode(req, res)
            }
            if (req.method !== 'GET') return next()
            const url = req.originalUrl ?? req.url ?? '/'
            // Fall through for requests Vite's own middleware owns — assets,
            // HMR, module transforms — and serve everything else as a page.
            //
            // This used to be `Accept: text/html` alone, which 404'd every
            // client that does not name HTML: curl, wget, health checks,
            // uptime monitors and most shell scripts all send `*/*`. The same
            // URL answered 200 in production, so the first thing anyone does
            // to check a dev server looked like a broken route.
            //
            // The path is the honest signal, but on its own it would 404 a
            // real route with a dot in its last segment (/blog/v1.2-release),
            // so an explicit `text/html` still wins: a browser navigating
            // there is served, while a missing /logo.png keeps getting Vite's
            // asset 404 instead of a page.
            if (!(req.headers.accept ?? '').includes('text/html') && isAssetRequest(url))
              return next()
            const entry = await server.ssrLoadModule(VIRTUAL.serverEntry)
            const { html, status, routeId, headers } = await entry.handle(
              url,
              entry.nodeRequest(req),
            )

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
            // Before statusCode/end — a cookie the config's `response` hook
            // set has to reach the wire in dev exactly as it does in prod, or
            // sign-in works in one and not the other.
            entry.applyHeaders(res, headers)
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
 * Naming: `<from>__<to>.ts` where a route id is written with dashes —
 * `/` becomes `-` and param brackets are dropped, so work/[slug] is
 * `work-slug` and `home__work-slug.ts` matches home → work/[slug].
 * Filenames resolve against the real route ids from pages/, so the
 * dash form stays unambiguous (colliding ids are a build error). The
 * legacy dot/bracket encoding (`home__work.[slug].ts`) still resolves.
 * `default.ts` is the fallback for unmatched pairs.
 */
function generateTransitions(transitionsDir, pagesDir) {
  const resolveId = routeIdResolver(pagesDir)
  const entries = []
  let hasDefault = false
  if (fs.existsSync(transitionsDir)) {
    for (const file of fs.readdirSync(transitionsDir)) {
      if (!file.endsWith('.ts')) continue
      // Colocated token modules for pair files, not transitions themselves.
      if (file.endsWith('.motion.ts')) continue
      const name = file.slice(0, -3)
      if (name === 'default') {
        hasDefault = true
        continue
      }
      const parts = name.split('__')
      if (parts.length !== 2) continue
      entries.push({ from: resolveId(parts[0]), to: resolveId(parts[1]), file })
    }
  }
  const lines = entries.map(
    (e) =>
      `  { from: ${JSON.stringify(e.from)}, to: ${JSON.stringify(e.to)}, load: () => import(${JSON.stringify(`/transitions/${e.file}`)}) },`,
  )
  const fallback = hasDefault ? `() => import('/transitions/default.ts')` : 'null'
  return `export const entries = [\n${lines.join('\n')}\n]\nexport const fallback = ${fallback}\n`
}

/** `work/[slug]` → `work-slug` — dashes walk into folders, brackets drop. */
function slugRouteId(id) {
  return id.replaceAll('/', '-').replaceAll(/[[\]]/g, '')
}

/**
 * Filename side → route id, resolved against the routes that actually exist:
 * dash form first, then the legacy dot/bracket encoding. Unknown names pass
 * through the legacy decode so `modulato check` can name the bad reference.
 */
function routeIdResolver(pagesDir) {
  const bySlug = new Map()
  const byLegacy = new Map()
  const walk = (dir, prefix) => {
    if (!fs.existsSync(dir)) return
    for (const dirent of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!dirent.isDirectory()) continue
      const id = prefix ? `${prefix}/${dirent.name}` : dirent.name
      const abs = path.join(dir, dirent.name)
      if (fs.existsSync(path.join(abs, 'page.tsx'))) {
        const slug = slugRouteId(id)
        if (bySlug.has(slug) && bySlug.get(slug) !== id)
          throw new Error(
            `[modulato] routes "${bySlug.get(slug)}" and "${id}" both shorten to "${slug}" in transition filenames — rename one of the folders.`,
          )
        bySlug.set(slug, id)
        byLegacy.set(encodeRouteId(id), id)
      }
      walk(abs, id)
    }
  }
  walk(pagesDir, '')
  return (name) => bySlug.get(name) ?? byLegacy.get(name) ?? decodeRouteId(name)
}

/** Legacy filename encoding: dots for `/`, brackets kept. Still accepted. */
function decodeRouteId(encoded) {
  return encoded.replaceAll('.', '/')
}

function encodeRouteId(id) {
  return id.replaceAll('/', '.')
}

/**
 * Action exports from a server.ts source. By convention actions are declared
 * as `export const <name> = action(...)` — same regex here and in the
 * manifest, so URLs always agree.
 */
function scanActionExports(code) {
  return [...code.matchAll(/^export\s+const\s+([A-Za-z_$][\w$]*)\s*=/gm)].map((m) => m[1])
}

/** Route ids can't contain `__` (folder names are [a-z0-9-] + brackets). */
function actionUrl(route, name) {
  return `/__modulato/action/${encodeRouteId(route)}__${name}`
}

/** Scan pagesDir for server.ts files and emit the (server-only) actions manifest. */
function generateActions(pagesDir) {
  const lines = []
  const walk = (dir, prefix) => {
    if (!fs.existsSync(dir)) return
    for (const dirent of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!dirent.isDirectory()) continue
      const id = prefix ? `${prefix}/${dirent.name}` : dirent.name
      const abs = path.join(dir, dirent.name)
      const serverFile = path.join(abs, 'server.ts')
      if (fs.existsSync(serverFile)) {
        for (const name of scanActionExports(fs.readFileSync(serverFile, 'utf8'))) {
          lines.push(
            `  { id: ${JSON.stringify(`${encodeRouteId(id)}__${name}`)}, exportName: ${JSON.stringify(name)}, load: () => import(${JSON.stringify(`/pages/${id}/server.ts`)}) },`,
          )
        }
      }
      walk(abs, id)
    }
  }
  walk(pagesDir, '')
  return `export const entries = [\n${lines.join('\n')}\n]\n`
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
/**
 * A drop-in `react/jsx-dev-runtime` that stamps each host element with the
 * file, line and column that authored it.
 *
 * Dev's JSX runtime is already handed `{ fileName, lineNumber, columnNumber }`
 * for every element — React keeps it on the fiber, where only devtools can
 * reach it. Copying it into a `data-modulato-source` attribute puts it in the
 * DOM, which is where an agent reading a page, the Tweak overlay, and anyone
 * with an inspector open are all actually looking.
 *
 * Wrapping the runtime rather than transforming JSX buys three things. No
 * parser, so this package keeps its zero dependencies. It works in SSR and on
 * the client without a second implementation, because both call this function.
 * And it cannot be swallowed: a JSX transform adds the attribute wherever the
 * element is written, so a component that does not spread its props drops it —
 * here the attribute is only ever added to a HOST element, whose props go
 * straight to the DOM.
 *
 * The real runtime is imported by resolved path: importing it by name would
 * resolve back through the alias to this module.
 */
function generateJsxDevRuntime(root) {
  // NAMED imports, and by SPECIFIER not path: the file behind it is CJS
  // (`module.exports = require('./cjs/…')`), so it has to go through Vite's
  // normal resolution and interop — reached by absolute path it dies with
  // ERR_AMBIGUOUS_MODULE_SYNTAX in the SSR runner. `Fragment` and `jsxDEV` are
  // everything the dev runtime exports.
  return [
    `import { Fragment as _Fragment, jsxDEV as _jsxDEV } from 'react/jsx-dev-runtime'`,
    `const ROOT = ${JSON.stringify(root)}`,
    `export const Fragment = _Fragment`,
    `export function jsxDEV(type, props, key, isStatic, source, self) {`,
    // Host elements only — a component would receive the attribute as an
    // unknown prop and either drop it or forward it to the wrong node.
    `  if (typeof type === 'string' && source && source.fileName) {`,
    `    const file = source.fileName.startsWith(ROOT)`,
    `      ? source.fileName.slice(ROOT.length)`,
    `      : source.fileName`,
    // LINE ONLY, no column. Vite's client and SSR transforms disagree about
    // where a parenthesised JSX expression starts (an arrow body, a ternary
    // branch) — ~19% of host elements in a real project, by a delta that
    // varies, so it cannot be corrected arithmetically. The attribute is the
    // only thing that differs between the two renders, so every such element
    // logged a React hydration mismatch. Lines always agreed, and the column
    // bought nothing: /__modulato/open hands this to Vite's
    // /__open-in-editor, which is happy with file:line, and an editor puts
    // the cursor on the right line either way.
    `    const at = file + ':' + source.lineNumber`,
    // Spread rather than assign: props may be frozen, and it is the caller's.
    `    if (!props || !props['data-modulato-source'])`,
    `      props = { ...props, 'data-modulato-source': at }`,
    `  }`,
    `  return _jsxDEV(type, props, key, isStatic, source, self)`,
    `}`,
    '',
  ].join('\n')
}

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

const VERCEL_LAUNCHER = `import { handle, handleActionNode, nodeRequest, applyHeaders } from './server.js'

export default async function (req, res) {
  try {
    if (req.method === 'POST' && (req.url ?? '').startsWith('/__modulato/action/')) {
      return await handleActionNode(req, res)
    }
    const { html, status, headers } = await handle(req.url ?? '/', nodeRequest(req))
    applyHeaders(res, headers)
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
function emitVercelOutput(root, config = {}, warn = console.warn) {
  const out = path.join(root, '.vercel/output')
  // Remove only what Modulato owns. The whole tree used to go, which meant a
  // project with its own function had to run after this step and could never
  // just put one there.
  fs.rmSync(path.join(out, 'static'), { recursive: true, force: true })
  fs.rmSync(path.join(out, 'functions/__ssr.func'), { recursive: true, force: true })
  fs.rmSync(path.join(out, 'config.json'), { force: true })

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
        runtime: config.runtime ?? defaultVercelRuntime(warn),
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
          // Caller routes go here — after the asset headers, before the
          // filesystem phase and the SSR catch-all, which is the only window
          // where a project's own function can win a path. Splicing them back
          // into generated JSON afterwards was the alternative, and it reached
          // into output whose shape nothing promised to keep.
          ...(config.routes ?? []),
          { handle: 'filesystem' },
          { src: '/(.*)', dest: '/__ssr' },
        ],
      },
      null,
      2,
    ),
  )
}

// Vercel's Node runtimes, newest last. A version outside this range is a hard
// deploy failure, so an unknown major clamps to the newest known one WITH a
// warning rather than shipping a runtime string Vercel will reject — and
// `modulato({ vercel: { runtime } })` overrides it the day a new one lands,
// so this list going stale can never block a deploy.
const VERCEL_NODE_RUNTIMES = [20, 22, 24]

/**
 * The runtime for the SSR function: the Node major running the build, so a
 * project on 24 does not silently deploy onto 22.
 */
function defaultVercelRuntime(warn = console.warn) {
  const major = Number(process.versions.node.split('.')[0])
  if (VERCEL_NODE_RUNTIMES.includes(major)) return `nodejs${major}.x`
  const newest = VERCEL_NODE_RUNTIMES.at(-1)
  const oldest = VERCEL_NODE_RUNTIMES[0]
  const pick = major > newest ? newest : oldest
  warn(
    `[modulato] Node ${major} is not a Vercel runtime this version knows about — ` +
      `the SSR function will run on nodejs${pick}.x. ` +
      `Set modulato({ vercel: { runtime: 'nodejs${major}.x' } }) if Vercel now supports it.`,
  )
  return `nodejs${pick}.x`
}

/**
 * Statically extract one literal string map (`breakpoints`, `eases`) from
 * modulato.config.ts — the config executes in Node for `modulato content`,
 * but the CLIENT only needs these plain literal objects, so they're read
 * from the AST (TS stripped by esbuild first) without importing node-only
 * adapter code into the bundle.
 * Returns null (framework defaults) when absent or not a plain literal.
 */
async function extractConfigStringMap(root, ctx, key) {
  const file = path.join(root, 'modulato.config.ts')
  if (!fs.existsSync(file)) return null
  try {
    const { code } = await transformWithEsbuild(fs.readFileSync(file, 'utf8'), file, {
      loader: 'ts',
      sourcemap: false,
    })
    const ast = ctx.parse(code)
    let config = null
    for (const node of ast.body) {
      if (node.type !== 'ExportDefaultDeclaration') continue
      const decl = node.declaration
      config =
        decl.type === 'CallExpression' && decl.arguments[0]?.type === 'ObjectExpression'
          ? decl.arguments[0]
          : decl.type === 'ObjectExpression'
            ? decl
            : null
    }
    const prop = config?.properties.find(
      (p) => p.type === 'Property' && (p.key.name ?? p.key.value) === key,
    )
    if (!prop || prop.value.type !== 'ObjectExpression') return null
    const map = {}
    for (const entry of prop.value.properties) {
      if (entry.type !== 'Property') continue
      const name = entry.key.name ?? entry.key.value
      if (typeof name !== 'string' || entry.value.type !== 'Literal') continue
      if (typeof entry.value.value !== 'string') continue
      map[name] = entry.value.value
    }
    return Object.keys(map).length ? map : null
  } catch (error) {
    console.warn(`[modulato] could not read ${key} from modulato.config.ts: ${error.message}`)
    return null
  }
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
