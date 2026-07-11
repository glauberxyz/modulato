import { matchRoute } from './matcher'
import type { ConfigModule, Entry, RouteDef } from './types'

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
): Promise<Entry | null> {
  const match = matchRoute(routes, pathname)
  if (!match) return null

  const [pageMod, cfg] = await Promise.all([
    match.route.page(),
    match.route.config ? match.route.config() : Promise.resolve<ConfigModule>({}),
  ])
  const loadArgs = { params: match.params, path: pathname }
  const resolvedProps = (props ??
    (cfg.load ? await cfg.load(loadArgs) : {}) ??
    {}) as Record<string, unknown>
  const meta = cfg.meta?.({ ...loadArgs, props: resolvedProps }) ?? {}

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
