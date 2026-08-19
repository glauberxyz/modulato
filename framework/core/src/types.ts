import type { ComponentType } from 'react'
import type { ModulatoContent } from './config'

export interface LoadArgs {
  params: Record<string, string>
  path: string
  /**
   * The content snapshot (run `modulato content` to pull + typegen).
   * Same data on server and client — loaders behave identically on first
   * paint and on client-side navigation.
   */
  content: ModulatoContent
  /**
   * The incoming request — **server-side only, and `undefined` otherwise.**
   *
   * `load()` runs in BOTH places: server-side for the first paint, and in the
   * BROWSER on every navigation after it. So this is present on the first
   * paint of a page and absent when the reader arrives at the same page by
   * clicking a link. Code that reads it must handle both, and it can never
   * hold a secret — anything derived from it ends up in `props`, which ship
   * to the client either way.
   *
   *   export function load({ request, params }: LoadArgs) {
   *     if (!request) return fetch(`/api/project/${params.slug}`).then((r) => r.json())
   *     return db.project(params.slug)          // first paint, no round trip
   *   }
   *
   * `modulato check` errors on a `load()` that reads it without a guard —
   * unguarded, it throws on the first link click and not before.
   */
  request?: Request
}

/** A `<link>` tag: `rel` + `href` required, any other attributes allowed. */
export interface HeadLink {
  rel: string
  href: string
  [attr: string]: string | boolean | undefined
}

/**
 * The content snapshot, or a function that fetches it.
 *
 * A function lets the snapshot live in its own chunk: it is not needed to
 * render the first page — SSR sends that page's props already — only to run a
 * `load()` during a client navigation. `@modulato/vite` passes a loader, so
 * the snapshot leaves the entry bundle and arrives on the first link click.
 */
export type ContentSource =
  | Record<string, unknown>
  | (() => Promise<Record<string, unknown>>)

/** A `<meta>` tag: `name` OR `property`, plus `content`. */
export interface HeadMeta {
  name?: string
  property?: string
  content: string
  [attr: string]: string | boolean | undefined
}

/** A `<script>` tag: external (`src`) or inline (`children`). */
export interface HeadScript {
  src?: string
  /** Inline script body (not escaped — you own it). */
  children?: string
  async?: boolean
  defer?: boolean
  type?: string
  [attr: string]: string | boolean | undefined
}

export interface MetaResult {
  title?: string
  description?: string
  /** Per-page `<link>` tags (SSR'd), e.g. canonical, per-project preload. */
  link?: HeadLink[]
  /** Per-page `<meta>` tags (SSR'd), e.g. og:title, og:image, twitter:*. */
  meta?: HeadMeta[]
  /**
   * Per-page `<script>` tags (SSR'd) — e.g. JSON-LD structured data. Head
   * scripts run on FIRST LOAD only; behavior on client navigation belongs in
   * hooks (see the analytics recipe in the docs), not here.
   */
  script?: HeadScript[]
}

export interface PageModule {
  default: ComponentType<Record<string, unknown>>
}

/**
 * Per-page smooth-scroll options, passed through to Lenis. `false` disables
 * smooth scrolling for the page entirely.
 */
export interface ScrollConfig {
  lerp?: number
  duration?: number
  smoothWheel?: boolean
  touchMultiplier?: number
  /**
   * Scroll memory. Session-only — a fresh landing always starts at the top.
   *
   * - `true`  — a LINK navigation back to this page lands where it was left
   *             (grid → detail → back-to-grid). Back/Forward restore too.
   * - `false` — this page ALWAYS opens at the top, Back and Forward included.
   *             For a page whose opening is choreographed: a restored scroll
   *             puts the choreography somewhere nobody can see, and the two
   *             then fight over the scroll position mid-transition.
   * - unset   — link navigations start at the top, Back/Forward restore.
   *
   * `navigate(path, { restoreScroll: true })` overrides whatever is set here,
   * for one navigation.
   */
  restore?: boolean
  [option: string]: unknown
}

export interface ConfigModule {
  load?: (args: LoadArgs) => unknown | Promise<unknown>
  meta?: (args: LoadArgs & { props: Record<string, unknown> }) => MetaResult
  scroll?: false | ScrollConfig
}

export interface RouteDef {
  /** Folder id relative to pages/, e.g. `home`, `work/[slug]` */
  id: string
  page: () => Promise<PageModule>
  config?: () => Promise<ConfigModule>
}

/** A resolved, renderable page instance. */
export interface Entry {
  key: string
  routeId: string
  path: string
  params: Record<string, string>
  props: Record<string, unknown>
  meta: MetaResult
  scroll?: false | ScrollConfig
  Component: ComponentType<Record<string, unknown>>
}

export interface RouterState {
  current: Entry
  next: Entry | null
}

export type NavPhase = 'idle' | 'loading' | 'transition'

/** Route info exposed to user code via hooks. */
export interface RouteInfo {
  id: string
  path: string
  params: Record<string, string>
}
