/**
 * A content source. Adapters run in Node (the `modulato content` command),
 * pull everything, denormalize references, and return one serializable
 * snapshot object. The snapshot is written to .modulato/content.json with
 * generated types, and handed to every page loader as `content`.
 */
export interface ContentAdapter {
  name: string
  pull(ctx: { root: string }): Promise<Record<string, unknown>>
}

/**
 * Site-wide `<head>` tags, SSR'd into every page: favicon, web manifest,
 * theme-color, font <link>s, default OG/Twitter tags, analytics scripts.
 * Per-page tags (og:title, og:image) come from `config.ts` `meta()` instead
 * and are appended after these, so a page can override.
 */
export interface HeadConfig {
  /** Document language (the `<html lang>` attribute). Default: 'en'. */
  lang?: string
  link?: import('./types').HeadLink[]
  meta?: import('./types').HeadMeta[]
  script?: import('./types').HeadScript[]
}

/**
 * What a `response` hook is handed. Server-only, once per SSR request.
 */
export interface ResponseContext {
  /** The incoming request — headers, cookies, url. */
  request: Request
  /**
   * Response headers. Set or append anything; use `cookies` for `Set-Cookie`
   * so multiple cookies don't overwrite each other.
   */
  headers: Headers
  /** Read the request's cookies, and write cookies onto this response. */
  cookies: import('./cookies').Cookies
}

export interface ModulatoConfig {
  /** Content source — e.g. localJson() from @modulato/content-local. */
  content?: ContentAdapter
  /**
   * Breakpoints, defined once and used everywhere: useViewport(), responsive
   * motion-token overrides, the Tweak overlay switcher. Names become override
   * keys in motion.ts; `desktop` is the implicit fallthrough. MUST be literal
   * strings — the client extracts them from this file statically. Defaults:
   * phone ≤767px, tablet 768–1279px.
   */
  breakpoints?: Record<string, string>
  /**
   * Named easing curves, declared once and usable in every motion.ts — by
   * NAME in GSAP tokens (`ease: 'swoosh'`) and as the curve itself in
   * transition tokens (WAAPI only speaks CSS). Both spellings appear in the
   * Tweak overlay's ease dropdown labeled with your name.
   *
   *   eases: { swoosh: 'cubic-bezier(0.16, 1, 0.3, 1)' }
   *
   * Values MUST be literal `cubic-bezier(x1, y1, x2, y2)` strings — the
   * client extracts them from this file statically, and a single cubic is
   * the one shape both animation backends express exactly. x1/x2 must be
   * within 0–1; y may overshoot. Names must not collide with GSAP's built-in
   * eases (power1–4/sine/expo/circ/back/elastic/bounce/none, `.in`/`.out`/
   * `.inOut`); `modulato check` enforces both rules.
   */
  eases?: Record<string, string>
  /** Site-wide <head> tags (favicon, manifest, fonts, default OG, analytics). */
  head?: HeadConfig
  /**
   * Run once per SSR request, BEFORE the page renders, to set response
   * headers or cookies — a session refresh, a first-visit cookie, a security
   * header. SERVER-ONLY: this file runs in Node, so it may hold secrets.
   *
   *   response({ request, cookies, headers }) {
   *     headers.set('x-frame-options', 'DENY')
   *     if (!cookies.get('visitor')) cookies.set('visitor', crypto.randomUUID(), { path: '/' })
   *   }
   *
   * It does not affect what renders — it cannot see the matched route, and a
   * cookie it sets is not visible to that request's own `load()`. Use it for
   * the response, and `ctx.request` in `load()` for the page.
   */
  response?: (ctx: ResponseContext) => void | Promise<void>
  /**
   * Re-run the content adapter's `pull()` at the START of `modulato build`, so a
   * deploy ships freshly-pulled content instead of the committed
   * `.modulato/content.json`. OFF by default — builds stay reproducible and need
   * no content-source credentials. Turn it on for CMS-backed sites that rebuild
   * via a deploy hook (publish → hook → rebuild → fresh content). A pull failure
   * at build warns and falls back to the committed snapshot; `modulato build
   * --no-content` forces the snapshot, `--refetch` forces a pull even when this is
   * off. Keep committing the snapshot either way — it's the offline fallback.
   */
  refetchOnBuild?: boolean
}

/** Identity helper for typed modulato.config.ts files. */
export function defineConfig(config: ModulatoConfig): ModulatoConfig {
  return config
}

/**
 * The shape of the content snapshot. EMPTY by design — running
 * `modulato content` generates .modulato/content.d.ts, which augments this
 * interface with the actual shape pulled from your content source. Loaders
 * receive it as `content`, fully typed.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface ModulatoContent {}
