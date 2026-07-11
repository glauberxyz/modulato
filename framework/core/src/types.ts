import type { ComponentType } from 'react'

export interface LoadArgs {
  params: Record<string, string>
  path: string
}

export interface MetaResult {
  title?: string
  description?: string
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
