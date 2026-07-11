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

export interface ConfigModule {
  load?: (args: LoadArgs) => unknown | Promise<unknown>
  meta?: (args: LoadArgs & { props: Record<string, unknown> }) => MetaResult
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
