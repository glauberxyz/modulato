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
}

/** A `<link>` tag: `rel` + `href` required, any other attributes allowed. */
export interface HeadLink {
  rel: string
  href: string
  [attr: string]: string | boolean | undefined
}

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
   * Scroll memory: when a LINK navigation returns to this page, land at the
   * position it was left at instead of the top (grid → detail → back-to-grid).
   * Session-only — a fresh landing always starts at the top. The browser
   * Back/Forward buttons restore scroll regardless of this flag.
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
