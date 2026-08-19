import type { IncomingHttpHeaders, IncomingMessage, ServerResponse } from 'node:http'

/**
 * The Node ↔ web bridge. Both places Modulato answers a request — the dev
 * middleware and the production function — speak Node's `IncomingMessage` /
 * `ServerResponse`, while everything above them speaks `Request` / `Headers`.
 * Converting in exactly one place is what keeps dev and prod from drifting.
 */

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

/**
 * The absolute URL of a Node request.
 *
 * `req.url` is path-only, and `Request` demands an absolute URL. The forwarded
 * headers come first because in production this runs behind a proxy, where
 * `req.headers.host` is the internal hostname and the scheme is always http —
 * so a `request.url` built from those alone would name a host the visitor
 * never typed.
 */
export function requestUrl(req: IncomingMessage): string {
  const headers: IncomingHttpHeaders = req.headers
  const proto = first(headers['x-forwarded-proto']) ?? 'http'
  const host = first(headers['x-forwarded-host']) ?? headers.host ?? 'modulato.internal'
  return new URL(req.url ?? '/', `${proto}://${host}`).toString()
}

/** Node request headers as a web `Headers`. */
export function requestHeaders(req: IncomingMessage): Headers {
  const headers = new Headers()
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === 'string') headers.set(key, value)
    else if (Array.isArray(value)) for (const item of value) headers.append(key, item)
  }
  return headers
}

/**
 * A web `Request` for a Node request. `body` is passed already-buffered when
 * there is one — reading it is the caller's job, since only they know whether
 * the body is wanted at all.
 */
export function nodeRequest(req: IncomingMessage, body?: BodyInit): Request {
  return new Request(requestUrl(req), {
    method: req.method ?? 'GET',
    headers: requestHeaders(req),
    ...(body === undefined ? {} : { body }),
  })
}

/**
 * Copy web `Headers` onto a Node response.
 *
 * `Set-Cookie` is the reason this is a function rather than a loop: it is the
 * one header that legitimately repeats, and iterating `Headers` joins repeats
 * with ", " — which browsers read as ONE malformed cookie, so setting two
 * cookies would set neither. `getSetCookie()` is the accessor that keeps them
 * apart, and Node's `setHeader` takes the array.
 */
export function applyHeaders(res: ServerResponse, headers: Headers | undefined): void {
  if (!headers) return
  for (const [key, value] of headers) {
    if (key.toLowerCase() === 'set-cookie') continue
    res.setHeader(key, value)
  }
  const cookies = headers.getSetCookie()
  if (cookies.length) res.setHeader('set-cookie', cookies)
}
