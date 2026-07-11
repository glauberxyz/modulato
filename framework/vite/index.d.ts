import type { Plugin } from 'vite'

export interface ModulatoPluginOptions {
  /** Directory scanned for page folders, relative to the Vite root. Default: `pages`. */
  pagesDir?: string
  /** Directory scanned for transition pair files. Default: `transitions`. */
  transitionsDir?: string
  /** First-load intro system (per-page `intro.ts`, default fade-in). Default: true. */
  intro?: boolean
}

export default function modulato(options?: ModulatoPluginOptions): Plugin
