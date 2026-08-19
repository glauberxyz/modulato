import type { Cookies, CookieOptions } from 'modulato'

/**
 * Cookie reading and writing for one request. The types live in `modulato`
 * (so a page's server.ts imports them from the one package it already uses);
 * this is the half that touches headers, and only ever runs in Node.
 */

/** A jar plus the `Set-Cookie` values written through it. */
export interface CookieJar extends Cookies {
  /** Every `Set-Cookie` header value this request produced, in write order. */
  readonly pending: readonly string[]
}

/** `a=1; b=2` → `{ a: '1', b: '2' }`. Malformed pairs are skipped. */
export function parseCookieHeader(header: string | undefined | null): Record<string, string> {
  const out: Record<string, string> = {}
  if (!header) return out
  for (const part of header.split(';')) {
    const eq = part.indexOf('=')
    if (eq < 1) continue
    const name = part.slice(0, eq).trim()
    if (!name) continue
    const value = part.slice(eq + 1).trim()
    try {
      out[name] = decodeURIComponent(value)
    } catch {
      // A value that isn't percent-encoded is still a value — a cookie set by
      // something other than us has no obligation to encode.
      out[name] = value
    }
  }
  return out
}

// A cookie name is an HTTP token: no control chars, no separators. A bad name
// does not error at the browser, it is silently dropped — so reject it here,
// where there is somebody to tell.
const TOKEN = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/

/** `name=value; Path=/; HttpOnly` — one `Set-Cookie` header value. */
export function serializeCookie(
  name: string,
  value: string,
  options: CookieOptions = {},
): string {
  if (!TOKEN.test(name))
    throw new Error(
      `[modulato] "${name}" is not a valid cookie name — letters, digits and !#$%&'*+-.^_\`|~ only (no spaces, commas, semicolons or equals). Browsers drop an invalid one silently.`,
    )
  if (options.partitioned && !options.secure)
    throw new Error(
      `[modulato] cookie "${name}" is partitioned but not secure — browsers require Secure with Partitioned. Add { secure: true }.`,
    )
  if (options.sameSite === 'none' && !options.secure)
    throw new Error(
      `[modulato] cookie "${name}" is sameSite: 'none' but not secure — browsers require Secure with SameSite=None. Add { secure: true }.`,
    )

  // Default Path=/ — without it the browser scopes the cookie to the
  // directory of whatever URL happened to set it, so a session set by an
  // action at /__modulato/action/… would be invisible to every page.
  const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${options.path ?? '/'}`]
  if (options.domain) parts.push(`Domain=${options.domain}`)
  if (options.maxAge !== undefined) parts.push(`Max-Age=${Math.floor(options.maxAge)}`)
  if (options.expires) parts.push(`Expires=${options.expires.toUTCString()}`)
  if (options.httpOnly) parts.push('HttpOnly')
  if (options.secure) parts.push('Secure')
  if (options.partitioned) parts.push('Partitioned')
  if (options.sameSite)
    parts.push(`SameSite=${options.sameSite[0].toUpperCase()}${options.sameSite.slice(1)}`)
  return parts.join('; ')
}

/**
 * A jar over one request's `Cookie` header. Writes go to `pending` AND to the
 * in-memory map, so a `get()` after a `set()` returns what was just written —
 * a handler that sets a session and then reads it back does not get a stale
 * answer from before its own write.
 */
export function createCookies(header: string | undefined | null): CookieJar {
  const jar = parseCookieHeader(header)
  const pending: string[] = []

  return {
    pending,
    get: (name) => jar[name],
    getAll: () => ({ ...jar }),
    set(name, value, options) {
      pending.push(serializeCookie(name, value, options))
      jar[name] = value
    },
    delete(name, options) {
      // Max-Age=0 AND a past Expires: the pair every browser honours, and
      // path/domain have to match the original or this expires nothing.
      pending.push(
        serializeCookie(name, '', { ...options, maxAge: 0, expires: new Date(0) }),
      )
      delete jar[name]
    },
  }
}
