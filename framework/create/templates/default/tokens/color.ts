import { colors } from 'modulato'

/**
 * The palette — every color in the project, as DATA.
 *
 * Each key becomes a CSS custom property on `:root`: `accent` is
 * `--accent`, read anywhere as `var(--accent)`. Modulato inlines the whole
 * block into every SSR response, so the first paint is already in the right
 * colors.
 *
 * Same argument as `type.ts`: a color is a value somebody wants to change
 * while looking at the page, and a stylesheet is not something the Tweak
 * overlay can safely author. As data it is editable live, saved back with an
 * AST-preserving edit — and a NEW color can be added from the page itself,
 * with the + button in the overlay's Colors tab.
 *
 * Renaming a color in the overlay also rewrites every `var()` that reads it,
 * across the project. Renaming it BY HAND here does not — so if you edit a
 * name in this file, search for the old one.
 *
 * Theme overrides stay in CSS. A `.is-dark { --bg: … }` block redefines these
 * same variables for a surface, which is a selector question rather than a
 * palette one, and it works by out-specifying the `:root` this generates.
 */
export default colors({
  bg: '#f5f3ee',
  fg: '#171717',
  muted: '#6f6f6f',
  accent: '#d96f4e',
  rule: '#e2ded5',
})
