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
  /** Site-wide <head> tags (favicon, manifest, fonts, default OG, analytics). */
  head?: HeadConfig
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
