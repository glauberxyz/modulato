import type { Plugin } from 'vite'

export interface ModulatoPluginOptions {
  /** Directory scanned for page folders, relative to the Vite root. Default: `pages`. */
  pagesDir?: string
  /** Directory scanned for transition pair files. Default: `transitions`. */
  transitionsDir?: string
  /** Directory scanned for enhancer files. Default: `behaviors`. */
  behaviorsDir?: string
  /** First-load intro system (per-page `intro.ts`, default fade-in). Default: true. */
  intro?: boolean
  /**
   * Emit Vercel Build Output API (.vercel/output) after the SSR build.
   * Auto-enabled when building on Vercel (VERCEL=1). Deploy with
   * `vercel deploy --prebuilt`.
   */
  vercel?: boolean
}

export default function modulato(options?: ModulatoPluginOptions): Plugin
