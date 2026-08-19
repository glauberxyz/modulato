/**
 * Cookie types. TYPES ONLY — the implementation lives in `@modulato/server`,
 * because reading and writing cookies is something only the server does.
 *
 * They live in core so that `ActionContext` (also core) can name them, and so
 * a page's `server.ts` gets them from the one import it already has.
 */

export interface CookieOptions {
  /** Default: `/` — the whole site, which is almost always what is meant. */
  path?: string
  domain?: string
  /** Absolute expiry. Prefer `maxAge` unless you have a specific instant. */
  expires?: Date
  /** Lifetime in SECONDS (not milliseconds — this is the header's own unit). */
  maxAge?: number
  /** Hide from `document.cookie`. Set this on anything session-shaped. */
  httpOnly?: boolean
  /** HTTPS only. */
  secure?: boolean
  sameSite?: 'strict' | 'lax' | 'none'
  /** CHIPS — partitioned by top-level site. Requires `secure`. */
  partitioned?: boolean
}

/**
 * Read and write cookies for one request.
 *
 * Writes are collected and flushed onto the response when the handler
 * returns, so `set()` takes effect without the handler touching a response
 * object. A `get()` after a `set()` sees the new value — the jar is the
 * request's cookies with your writes applied over them.
 */
export interface Cookies {
  get(name: string): string | undefined
  /** Every cookie on the request, with this handler's writes applied. */
  getAll(): Record<string, string>
  set(name: string, value: string, options?: CookieOptions): void
  /**
   * Expire a cookie. `path`/`domain` must MATCH the ones it was set with —
   * browsers treat those as part of a cookie's identity, so a delete with the
   * wrong path silently does nothing.
   */
  delete(name: string, options?: Pick<CookieOptions, 'path' | 'domain'>): void
}
