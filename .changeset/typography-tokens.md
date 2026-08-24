---
'modulato': minor
'@modulato/tweak': minor
'@modulato/vite': minor
'@modulato/server': minor
'@modulato/mcp': patch
'create-modulato': minor
---

Typography as tokens: `type.ts`, generated CSS, and Type Mode in the overlay

A site's type system now lives in a `type.ts` at the project root, as data —
font stacks, a closed size scale, and the named styles built from them, with
breakpoint override blocks spelled exactly as a `motion.ts`'s. The same
argument as motion tokens, applied to type: a size or a leading is a number
somebody wants to nudge while looking at the page, so it belongs somewhere it
can be read, edited and written back.

- **`typography({...})`** (from `modulato`) plus `typeCss()`, which renders the
  module to `:root` custom properties, one `.type-<name>` utility class per
  style, and a `@media` block per breakpoint override. `@modulato/server`
  **inlines it into every SSR response**, so the first painted glyph is already
  correct — no stylesheet round trip, no flash of the default face.
- **Type Mode** in the Tweak overlay: a Typography card that edits the whole
  system (breakpoint tabs included), and a *Click text* toggle that turns the
  page into the control — hover any text for a `Tt` badge naming its style,
  click for a card with the style, the class carrying it, the file:line that
  authored the element, and controls for size, leading and kerning. Size steps
  through the project's scale rather than offering a free pixel slider. Each
  edit picks its target first — the style, or just the clicked class (written
  to `overrides`, emitted as custom properties scoped to the selector, so no
  specificity fight can decide it differently).
- **The writeback learned `type.ts`**, so the overlay, `modulato tokens` and
  `@modulato/mcp` all reach it through the path a `motion.ts` already used. It
  can now also create a key that isn't in the file yet (a per-selector
  override), and it **matches the file's own indentation** — recast defaults to
  four spaces, which reprinted a two-space file's whole object and turned one
  saved slider into a 150-line diff.
- **`modulato check`** errors on a `--type-…` variable naming no style or scale
  step (what a rename leaves behind — `var()` falls back silently, so the text
  just renders wrong), and warns when a page stylesheet declares `font-family`
  or `font-size` directly.
- **`create-modulato`** scaffolds `type.ts`, a numbers-free
  `styles/typography.scss`, and a `/styleguide` page rendering the styles, the
  scale and the color variables from the live values — deletable in one folder.

Type Mode is also reachable without the panel: a round **Tt** button beside the
✦ Tweak launcher arms it in one press, and fills in while it is on.
