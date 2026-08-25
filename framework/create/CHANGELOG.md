# create-modulato

## 0.4.0

### Minor Changes

- 4216a11: Units are the framework's decision, not the author's: type ships in rem, and a fluid size is two numbers

  `type.ts` never contained a unit and still doesn't — but a bare `size` number
  now emits **rem** rather than px (`18` → `1.125rem`). The author keeps writing
  the px the design was drawn at, which is what a designer and a generated
  stylesheet both reason in; the division by the root size is the framework's
  job. The effect is that a reader who has raised their browser's font-size
  setting gets larger text. That setting and page zoom are different
  affordances — zoom scales the whole page, the font-size setting scales only
  text — and rem is the only unit that hears the second one.

  Layout is the other half of the rule and stays **px**. The scaffold's page
  stylesheets were written in rem, which is the one combination with no coherent
  story: a reader who asked for bigger text got a layout that inflated around
  type that did not move. They are now px throughout, and `styles/tokens.scss`
  states the convention where a stylesheet author will meet it.

  `modulato check` **warns** when a page stylesheet sizes layout in rem, next to
  the warning it already emits for declaring `font-size` there — the two halves
  of one rule, and the half a generated stylesheet is most likely to get wrong.
  It is a warning, not an error, so it does not fail the gate. Media and
  container queries are exempt (a breakpoint in rem is a real position), as are
  `em` and `ch`, which say the length tracks the type it holds.

  A size that grows with the viewport is now data rather than a `clamp()` string:

  ```ts
  fluid: { from: 390, to: 1440 },              // the range, once, for the scale
  scale: {
    display:   { min: 44, max: 90 },           // 44px at 390, 90px at 1440
    statement: { min: 40, max: 190, from: 320, to: 1600 },   // its own range
  }
  ```

  Modulato solves the line through the two points and emits
  `clamp(2.75rem, 1.6821rem + 4.381vw, 5.625rem)`. Two reasons it belongs in the
  token file. It is the accessible spelling — keeping the middle term's intercept
  in rem is what lets a fluid size answer both the font-size setting and zoom,
  where a `clamp(44px, 9vw, 90px)` answers neither, since zoom does not change
  the viewport width in CSS pixels. And it stays editable: Tweak puts a slider on
  every number in the token tree, so a `{ min, max }` step gets two of them, live
  on the page, where a `clamp()` string is a value the overlay can name but not
  move — and the fluid steps are usually the headlines, i.e. the sizes most worth
  nudging.

  Hand-written `clamp()` values still pass through untouched. They just encode a
  viewport range nobody wrote down, which is what `fluid` exists to state.

  **Upgrading.** Nothing to change: existing `type.ts` files keep working, and at
  the default root size every page renders identically. Sites that size layout in
  rem should sweep it to px to get the benefit — otherwise the layout scales with
  the text and the two cancel out.

## 0.3.0

### Minor Changes

- 15cbd6e: Color as tokens: `color.ts`, and a Colors tab that actually edits

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

## 0.2.0

### Minor Changes

- aa9b2bb: Typography as tokens: `type.ts`, generated CSS, and Type Mode in the overlay

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
    system (breakpoint tabs included), and a _Click text_ toggle that turns the
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

  Type Mode is also reachable without the panel: a round **Aa** button beside the
  ✦ Tweak launcher arms it in one press, and fills in while it is on. Font stacks
  are shown but not editable in the overlay — a stray character in one silently
  falls the whole site back to Times, and a typeface is a decision made once in
  `type.ts`, next to the webfont link it depends on.

  The overlay is now tabbed — **Motion**, **Typography** and **Colors** — rather
  than one scroll holding all three. Colors is read-only: colors are CSS custom
  properties in a stylesheet, not a token module, so there is nothing to write
  back to; it lists the `:root` palette and copies a `var()` on click.

  **Escape** backs out one step at a time — the type card, then Type Mode, then
  the panel — and blurs a focused panel field before any of that.

## 0.1.9

### Patch Changes

- c6d364d: Fix two documented commands that could not work.

  - `claude mcp add modulato -- npx modulato-mcp` — there is no `modulato-mcp`
    package on npm (E404). `modulato-mcp` is the BIN provided by
    **`@modulato/mcp`**, so the command only resolved if that package already
    happened to be installed locally, and failed for exactly the person
    following the docs to set it up. It is now `npx -y @modulato/mcp`.
  - MODULATO.md's header told agents to scaffold a new site with `npx modulato
new`, which requires an existing site and rejects an empty directory. Site
    creation is `npm create modulato@latest <dir>`, which the reference never
    mentioned. Both are now stated, in the header and in the CLI section.

- c6d364d: Scaffold the current framework, not one six minors old.

  The template pinned `^0.1.0` for every Modulato package. On a `0.x` line caret
  never crosses a minor, so the range could never reach `0.7.0` — `npm create
modulato@latest` installed `modulato@0.1.7`, and no `npm update` could have
  fixed it. It hid well: the scaffolded site worked, it was just an old
  framework that disagreed with the MODULATO.md shipped beside it.

  The ranges are now GENERATED from the versions being released
  (`scripts/sync-template-deps.mjs`, run by `changeset:version` and enforced by
  CI) rather than hand-maintained.

  Also: the template declares `engines.node >= 24` and ships an `.nvmrc`. Its
  default `dev` script runs through portless, which requires Node 24 — without
  its own `engines` the install warning named portless instead of the site,
  reading like a broken dependency rather than "this template wants Node 24".

## 0.1.8

### Patch Changes

- 32dcdf8: Refresh the bundled MODULATO.md reference: Tweak Mode section matches the
  redesigned overlay (view-scoped token list, breakpoint/reduced tabs, dirty
  dots, "✦ Tweak" launcher) and documents that dev slow-mo drives `useTicker`
  loops on the motion clock (raw `ticker.add()` stays realtime).
