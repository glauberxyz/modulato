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

export interface ModulatoConfig {
  /** Content source — e.g. localJson() from @modulato/content-local. */
  content?: ContentAdapter
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
