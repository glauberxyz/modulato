import { DEV } from './dev'
import { createTokenRegistry } from './registry'

/**
 * Color tokens: the site's palette, as DATA.
 *
 *   // color.ts (project root)
 *   export default colors({
 *     paper: '#f4f1ea',
 *     ink: '#231f20',
 *     muted: '#7a7a75',
 *   })
 *
 * Each key becomes a CSS custom property on `:root` — `paper` is `--paper` —
 * so every `var(--paper)` already in the project's stylesheets keeps working
 * unchanged. Only the DECLARATION moves; the references never do.
 *
 * The reason to move it is the same one that moved type: a color is a value
 * somebody wants to change while looking at the page, and a `.scss` file is
 * not something the overlay can safely write. As data it is editable live,
 * saved back with an AST-preserving edit, and — the part a stylesheet cannot
 * do at all — a NEW color can be added from the page itself.
 *
 * What deliberately stays in CSS: theme overrides. A `.is-dark` block that
 * redefines `--paper` is a selector question, not a palette question, and it
 * keeps working exactly as before by out-specifying the `:root` this emits.
 */
export function colors<T extends ColorSpec>(spec: T): T {
  return spec
}

/** A flat palette: variable name → CSS color. */
export type ColorSpec = Record<string, string>

/** The one color.ts a project has; its id in the token registry. */
export const COLOR_FILE = '/color.ts'

/** The `<style>` element carrying the generated palette, in SSR and client. */
export const COLOR_STYLE_ID = '__modulato-color'

/** A CSS identifier fragment — variable names are built from author keys. */
const safeKey = (key: string) => key.replace(/[^a-zA-Z0-9_-]/g, '-')

/**
 * Generate the palette's `:root` block.
 *
 * Runs in Node (SSR inlines it, so the first paint is already in the right
 * colors) and in the browser (Tweak re-runs it on every edit). One function,
 * so the preview and the shipped site cannot disagree.
 */
export function colorCss(spec: ColorSpec | null | undefined): string {
  if (!spec) return ''
  const lines = Object.entries(spec)
    .filter(([, value]) => typeof value === 'string')
    .map(([name, value]) => `  --${safeKey(name)}: ${value};`)
  return lines.length ? `:root {\n${lines.join('\n')}\n}` : ''
}

/**
 * Dev-only palette registry — the same shape as the motion and typography
 * ones, and written back by the same endpoint.
 */
export const colorRegistry = createTokenRegistry()

/** Put the generated CSS in the document, creating the tag if SSR didn't. */
function paint(spec: ColorSpec | null): void {
  if (typeof document === 'undefined') return
  const css = colorCss(spec)
  let el = document.getElementById(COLOR_STYLE_ID)
  if (!el) {
    if (!css) return
    el = document.createElement('style')
    el.id = COLOR_STYLE_ID
    // First in <head>, so a project's own stylesheet can still override a
    // value at `:root` if it wants to — the palette is a floor, not a ceiling.
    document.head.prepend(el)
  }
  if (el.textContent !== css) el.textContent = css
}

/**
 * Called from the client bootstrap with the project's `color.ts` (or null).
 *
 * In production this only repaints when SSR left no style tag — normally a
 * no-op. In dev it registers the tokens and repaints on every registry edit,
 * which is what turns a swatch in the overlay into a change on the page.
 */
export function initColors(spec: ColorSpec | null | undefined): void {
  const tokens = spec ?? null
  paint(tokens)
  if (!DEV || typeof window === 'undefined' || !tokens) return
  colorRegistry.register(COLOR_FILE, tokens)
  colorRegistry.subscribe(() => paint(tokens))
}

/**
 * Re-register on HMR of color.ts, from the dev transform @modulato/vite adds.
 * Registering is the whole job — `initColors`' subscription repaints from the
 * live object, so an edit in the editor and an edit in Tweak converge.
 */
export function __registerColors(spec: unknown): void {
  if (!DEV || typeof window === 'undefined') return
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) return
  colorRegistry.register(COLOR_FILE, spec)
}
