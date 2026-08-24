---
'modulato': minor
'@modulato/tweak': minor
'@modulato/vite': minor
'@modulato/server': minor
'create-modulato': minor
---

Color as tokens: `color.ts`, and a Colors tab that actually edits

The palette now lives in a `color.ts` at the project root, as data. Each key
becomes a `:root` custom property — `accent` is `--accent` — and the whole
block is inlined into every SSR response, so the first paint is already in the
right colors. Only the DECLARATION moves: every `var(--accent)` already written
across a project's stylesheets keeps working untouched.

That is what closes the loop the Colors tab was missing. It shipped read-only,
because colors were a stylesheet and the overlay can only write token modules.
As a token module it is the same AST-preserving writeback everything else uses:

- **Each row** is a swatch (a real colour picker), the variable name, the value
  and a copy button for `var(--name)`.
- **+ adds a colour.** Name it and the variable exists — in the running page
  immediately, in `color.ts` on Save. A stylesheet cannot do this at all.
- **Renaming rewrites the references.** Renaming only the declaration would
  leave every `var(--old)` pointing at a property nobody declares, and `var()`
  on an undeclared name is a silent fallback rather than an error — the colour
  would simply stop applying. So a rename also rewrites every `var(--old)` read
  and every `--old:` declaration across the project, and reports what it
  touched (`--muted → --quiet · 27 references in 9 files`). It lands
  immediately rather than on Save, because it changed files the token module
  does not own. Renaming by hand in `color.ts` does none of this.

Theme overrides stay in CSS: a `.is-dark { --bg: … }` block is a question about
where a colour applies, not what it is, and it keeps working by out-specifying
the generated `:root`. The demo's now points back at the palette's own `dark-*`
entries instead of duplicating the hex values.

**`npm run check` now typechecks the scaffold template.** It never did, and a
scaffolded site could fail its own first `npm run check`: `pages/styleguide/
page.tsx` shipped in create-modulato@0.2.0 indexing a literal object type with
a `string`. Fixed, and the template's `tsconfig.json` include list now covers
`type.ts` and `color.ts`, which were invisible to both that gate and the user's.
