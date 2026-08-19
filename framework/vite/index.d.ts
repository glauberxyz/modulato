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
  /**
   * Stamp every host element with `data-modulato-source="/file.tsx:line:col"`
   * in dev. Default: true.
   *
   * Dev's JSX runtime is already handed the source location for every element;
   * React keeps it on the fiber, where only devtools can read it. This copies
   * it into the DOM, which is where an agent reading a page, an inspector, and
   * the Tweak overlay are all actually looking.
   *
   * Dev only — a production build compiles to a different JSX runtime, so not
   * a byte of it ships. Set false if snapshot diffs or DOM tests get noisy.
   */
  sourceAttribute?: boolean
  /**
   * Tweak Mode (dev-only overlay + token writeback), active when
   * @modulato/tweak is installed. Set false to disable.
   */
  tweak?: boolean
}

export default function modulato(options?: ModulatoPluginOptions): Plugin
