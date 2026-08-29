# @modulato/mcp

## 0.1.8

### Patch Changes

- fecfeb1: Dependency hygiene: drop server's stray hard dep on core, bump the MCP SDK

  `@modulato/server` declared `modulato` twice — as a peer (`>=0.1.5 <1.0.0`,
  the range that is actually meant) and as a plain dependency pinned to `*`.
  The `*` entry has been there since the first commit and was simply missed
  when the framework packages standardised on peer-only ranges. npm dedupes it
  against the site's own copy in practice, so nothing was visibly broken, but
  it meant `npm i @modulato/server` quietly pulled a second `modulato` instead
  of reporting a missing peer — and core exports a React context and a live
  token registry, so two copies is the one failure mode worth being strict
  about. The peer already says everything the dependency was saying.

  `@modulato/mcp` moves the `@modelcontextprotocol/sdk` floor to `^1.30.0`.
  The SDK is the only advisory chain that reached a published package's install
  tree — it carries hono, `@hono/node-server`, ajv's fast-uri and
  express-rate-limit's ip-address, all of which had open advisories at the
  range's old floor. Everything else `npm audit` flagged was build tooling.

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

- Updated dependencies [4216a11]
  - modulato@0.11.0
  - @modulato/tweak@0.7.0

## 0.1.7

### Patch Changes

- Updated dependencies [15cbd6e]
  - modulato@0.10.0
  - @modulato/tweak@0.6.0

## 0.1.6

### Patch Changes

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

- Updated dependencies [aa9b2bb]
  - modulato@0.9.0
  - @modulato/tweak@0.5.0

## 0.1.5

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

- Updated dependencies [c6d364d]
- Updated dependencies [c6d364d]
  - modulato@0.8.0
  - @modulato/tweak@0.4.1

## 0.1.4

### Patch Changes

- Updated dependencies [63bec8a]
- Updated dependencies [b56a79c]
- Updated dependencies [bec56e7]
- Updated dependencies [d0ff799]
  - modulato@0.6.0
  - @modulato/tweak@0.4.0

## 0.1.3

### Patch Changes

- Updated dependencies [94c05a8]
- Updated dependencies [31c3d17]
  - modulato@0.4.0
  - @modulato/tweak@0.3.0

## 0.1.2

### Patch Changes

- Updated dependencies [0c72f30]
- Updated dependencies [1359135]
- Updated dependencies [17d1397]
- Updated dependencies [731dffc]
- Updated dependencies [d0ac140]
  - modulato@0.3.0
  - @modulato/tweak@0.2.0

## 0.1.1

### Patch Changes

- 3a57bca: Widen the `modulato` dependency range to any 0.x (`>=0.1.0 <1.0.0`) so a core
  **minor** release no longer forces these packages to a major version bump. Core
  and the framework packages version together on the 0.x line; the range next needs
  revisiting when core reaches 1.0.
- Updated dependencies [9b927a0]
- Updated dependencies [acd438d]
- Updated dependencies [8a1bd2a]
- Updated dependencies [3a57bca]
  - modulato@0.2.0
  - @modulato/tweak@0.1.2
