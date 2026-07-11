import type { RouteDef } from './types'

/** `home` → [], `work/[slug]` → ['work', ':slug'] */
export function toPattern(id: string): string[] {
  if (id === 'home') return []
  return id
    .split('/')
    .map((seg) =>
      seg.startsWith('[') && seg.endsWith(']') ? `:${seg.slice(1, -1)}` : seg,
    )
}

export interface RouteMatch {
  route: RouteDef
  params: Record<string, string>
}

export function matchRoute(routes: RouteDef[], pathname: string): RouteMatch | null {
  const segs = pathname.split('/').filter(Boolean).map(decodeURIComponent)
  const candidates = routes
    .map((route) => ({ route, pattern: toPattern(route.id) }))
    .filter(({ pattern }) => pattern.length === segs.length)
    .sort(
      (a, b) =>
        a.pattern.filter((s) => s.startsWith(':')).length -
        b.pattern.filter((s) => s.startsWith(':')).length,
    )

  outer: for (const { route, pattern } of candidates) {
    const params: Record<string, string> = {}
    for (let i = 0; i < pattern.length; i += 1) {
      const seg = pattern[i]
      if (seg.startsWith(':')) params[seg.slice(1)] = segs[i]
      else if (seg !== segs[i]) continue outer
    }
    return { route, params }
  }
  return null
}
