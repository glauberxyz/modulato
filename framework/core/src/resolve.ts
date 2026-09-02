import { matchRoute } from './matcher'
import type { ConfigModule, ContentSource, Entry, LoadArgs, RouteDef } from './types'

/**
 * A loader is called ONCE and its result kept: every later navigation reuses
 * the same object, so the chunk is fetched once and `load()` sees a stable
 * snapshot rather than a fresh parse per navigation.
 */
let cached: Record<string, unknown> | null = null
async function resolveContent(source: ContentSource): Promise<Record<string, unknown>> {
  if (typeof source !== 'function') return source
  cached ??= await source()
  return cached
}

/**
 * Match a path and build a renderable Entry: load the page module, run the
 * loader (unless `props` is provided, e.g. hydrating server-loaded data),
 * and compute meta.
 */
export async function resolveEntry(
  routes: RouteDef[],
  pathname: string,
  key: string,
  props?: Record<string, unknown>,
  content: ContentSource = {},
  /** SSR only — the incoming request, handed to `load()` as `ctx.request`. */
  request?: Request,
): Promise<Entry | null> {
  const match = matchRoute(routes, pathname)
  if (!match) return null

  const [pageMod, cfg] = await Promise.all([
    match.route.page(),
    match.route.config ? match.route.config() : Promise.resolve<ConfigModule>({}),
  ])
  // The runtime passes the snapshot as plain data; its typed shape
  // (ModulatoContent) is the app's business via generated augmentation.
  // The snapshot is only touched when this route has to RUN its `load()` —
  // which is never on first paint, where SSR already sent the props. So a
  // `content` given as a loader stays unfetched until the first client
  // navigation, and the initial page never pays for it.
  const snapshot = cfg.load && props === undefined ? await resolveContent(content) : {}
  const loadArgs: LoadArgs = {
    params: match.params,
    path: pathname,
    content: snapshot as unknown as LoadArgs['content'],
    request,
  }
  const resolvedProps = (props ??
    (cfg.load ? await cfg.load(loadArgs) : {}) ??
    {}) as Record<string, unknown>
  // Hydration (`props` given) does not run `meta()` at all. The server ran it
  // and the answer is already in the document — the title in `<title>`, the
  // rest in the head — so running it again computes a string nobody reads.
  // It also cannot be run correctly here: the snapshot above is deliberately
  // `{}` on first paint, and a `meta()` reading `content` is the documented
  // way to build a title, so it would throw on the empty object and take
  // `boot()` down with it. `Entry.meta` is only ever consumed on navigation
  // (root.tsx applies `next.meta.title`), and a navigation resolves with
  // `props === undefined` — so the entry that skips it here is the one entry
  // whose meta is never read.
  const meta =
    props === undefined ? (cfg.meta?.({ ...loadArgs, props: resolvedProps }) ?? {}) : {}

  return {
    key,
    routeId: match.route.id,
    path: pathname,
    params: match.params,
    props: resolvedProps,
    meta,
    scroll: cfg.scroll,
    Component: pageMod.default,
  }
}
