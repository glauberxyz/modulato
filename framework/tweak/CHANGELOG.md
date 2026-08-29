# @modulato/tweak

## 0.8.0

### Minor Changes

- 4d5103a: The site-wide token modules move into `tokens/`

  `type.ts`, `color.ts` and the shell's `motion.ts` are one set — the three files
  that say how a site is set, all data, all editable live in the overlay and
  written back to disk — so they now live together in `tokens/` rather than as
  three loose files at the project root. They stay out of `modulato.config.ts`
  deliberately: that file runs in Node and may hold secrets, while these are read
  by the browser.

  **Nothing was removed.** A project scaffolded before this keeps its root
  `type.ts`/`color.ts`/`motion.ts` and works untouched — the plugin, Tweak's Save
  path and `modulato check` all accept both spellings. `modulato check` warns
  until they are moved and prints the exact `git mv`, the import rewrites and the
  `tsconfig.json` change.

  The registry id a token file is held under is now read from where the file
  actually is, rather than assumed, so Tweak Saves to the right path in either
  layout.

## 0.7.0

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

## 0.6.0

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

## 0.5.0

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

## 0.4.1

### Patch Changes

- c6d364d: `data-modulato-source` drops the column, ending a hydration warning on every page.

  Vite's client and SSR transforms disagree about where a parenthesised JSX
  expression starts — an arrow body, a ternary branch — for roughly one host
  element in five, by a delta that varies, so it could not be corrected
  arithmetically. The attribute was the only thing that differed between the two
  renders, so each of those elements logged a React hydration mismatch. The
  noise trains people to ignore hydration warnings, which is exactly when a real
  one appears.

  Lines agreed on every element measured, and the column bought nothing:
  `/__modulato/open` hands the value to Vite's `/__open-in-editor`, which is
  happy with `file:line`, and an editor puts the cursor on the right line either
  way. The attribute is now `/pages/home/page.tsx:78`.

## 0.4.0

### Minor Changes

- bec56e7: Inspect mode: hold Option (Alt) and click any element to open the line that authored it.

  Reads the `data-modulato-source` attribute the Vite plugin stamps in dev, so it names the
  real file, line and column rather than guessing from a class name. Holding the key outlines
  whatever is under the cursor and labels it, so you can see what you are about to open; the
  click is swallowed, so neither the site's handlers nor the browser's own Option-click
  behaviour fire.

  Resolution goes through a new `GET /__modulato/open`, because Vite's `/__open-in-editor`
  resolves relative paths against `process.cwd()` — rarely the Vite root in a monorepo — and
  answers 200 even when the file does not exist. The endpoint resolves against the real root,
  refuses paths that escape it, and turns a miss into a message instead of nothing happening.

### Patch Changes

- b56a79c: A token group that shows only an override block now says so.

  The icon tab strip was gated on there being more than one block with rows —
  so it vanished in exactly the two cases where it was the only thing explaining
  what you were looking at: a group whose leaves all come from override blocks
  with no base sibling, and a query that narrows a group to one block. Either way
  `phone` or `reduced` values rendered with nothing to distinguish them from base
  values, and editing one looked like editing the default. The strip now shows
  whenever there is a choice to make OR the block on screen is not `base`. A
  single tab is not redundant; it is the label.

  A leaf overridden in BOTH spellings at once — `claim.reduced.amount` and
  `reduced.claim.amount` — folds to the same group, block and name, so it renders
  as two identical rows of which only one is read. The dead one is dimmed and
  titled. Which one is dead is the opposite of what you might expect: the
  colocated block merges as the resolver descends and the hoisted one merges at
  the outer level afterwards, so the HOISTED value lands last and wins. It is
  marked rather than hidden — the value really is in the file, and deleting it
  there is the fix.

## 0.3.1

### Patch Changes

- 184f1ef: The token filter matches file paths, not only token paths.

  The file path is rendered directly above a card's rows and was the one thing in
  the panel you could not search for. In a project with more than a handful of
  motion files you could find `duration` — and get every file at once — but not
  "everything for the screen chapter", and typing a folder name returned nothing
  at all.

  A file-path hit shows that file's rows UNFILTERED, which is the behaviour the
  query asks for: the reader named a place, not a value, so narrowing the rows
  would answer a question nobody asked and leave the card standing with most of
  its contents missing. A token hit keeps narrowing as before, and the two
  compose — in the demo, `figure` returns four `[figure]/motion.ts` cards whole
  plus the shell's own file cut down to the six rows that mention one.

  The dirty-row escape hatch is unchanged: a row with unsaved edits stays visible
  under any query, because what Save will write must never be off-screen.

- 63e99d1: The overlay folds breakpoint/`reduced` override blocks into a group's icon
  tabs wherever the override segment sits in the path, not only when it is the
  leaf's immediate parent.

  `resolveTokens` treats override keys as reserved at every nesting level, so
  `claim.reduced.amount` and `reduced.claim.amount` resolve identically — but
  the overlay only folded the first spelling. A hoisted block, or an override
  carrying a nested group (`enter.phone.tint.duration`), rendered as a separate
  card named after the override (`intro › reduced › claim`,
  `flight › back › phone › contents`) instead of landing in the real group's
  phone/reduced tab. The fold now matches the resolver: the override segment
  nearest the leaf names the tab, and the group is the path without it. Rows
  keep their original paths, so editing, dirty-tracking and Save write back to
  wherever the block actually lives in the source.

- 46bef7b: Motion groups can carry hidden search keywords.

  A group is named for what it IS in the code and people search for what it DOES
  on the page. "main description" is the chapter lede, governed by
  `flight.enter.lede`, and no substring of that query reaches it — the vocabulary
  is private to whoever named the group, and the problem widens as a site grows.

  A motion file may now export `keywords` beside its default:

  ```ts
  export const keywords: Record<string, string[]> = {
    "flight.enter.lede": ["main description", "subtitle"],
  };
  ```

  The Tweak overlay indexes them and never renders them. A keyword hit shows the
  group's rows unfiltered, the same as a file-path hit: the reader named a
  purpose, not a value.

  A separate EXPORT rather than a key inside `motion({...})`, and rather than the
  magic comment first sketched for this. The token tree is numbers-and-eases —
  `resolveTokens` hands it straight to animation code — so a `keywords` key would
  become a row in the panel, widen the resolved type, and need special-casing at
  every consumer. A comment would have needed a source parser in `@modulato/vite`
  to reach the browser at all, and resolving a nested group's full path from raw
  text is exactly the kind of thing that works until it doesn't; an export is
  real JS that arrives for free.

  `modulato check` warns when a keywords entry names no group in its file, which
  is what a rename leaves behind. A warning, not an error — a stale keyword costs
  discoverability, never correctness.

  The other half of this is a convention, so it is written down where both people
  and coding agents will meet it: MODULATO.md's motion-token section, and the
  `CLAUDE.md` that `create-modulato` scaffolds into every new project. Authoring a
  token group now means naming it AND saying what a reader would call it.

## 0.3.0

### Minor Changes

- 94c05a8: Custom easing curves are now declared once in `modulato.config.ts` and work in
  both animation backends:

  ```ts
  export default defineConfig({
    eases: { swoosh: "cubic-bezier(0.62, 0.05, 0.01, 0.99)" },
  });
  ```

  - `@modulato/gsap` registers each curve with GSAP's CustomEase, so a GSAP
    token can say `ease: 'swoosh'` and a tween resolves it by name. Registration
    subscribes to the registry rather than reading it once, so it can't lose the
    race with `boot()` whichever order modules evaluate in; `@modulato/vite`
    pulls the registrar into the client entry when — and only when — the config
    declares curves, so an intro using raw `gsap` on a page that never imports
    `useMotion` still gets them (an unregistered name silently falls back to
    `quad.out`).
  - Transition tokens hold the same curve as its `cubic-bezier(…)`, since WAAPI
    only speaks CSS. The Tweak overlay lists declared curves at the top of BOTH
    ease catalogs under your config name and writes whichever spelling the file
    being edited needs.
  - `modulato check` validates the declarations: values must be literal
    `cubic-bezier(x1, y1, x2, y2)` strings with x1/x2 in 0–1, and names may not
    shadow a built-in GSAP ease — including the legacy aliases (`quad`, `cubic`,
    `quart`, `quint`, `strong`, `power0`) and any casing, since registering one
    would replace GSAP's own. It reads the config by stripping comments and
    brace-matching the block, so commented-out lines and neighbouring config
    keys can't produce phantom errors, and it rejects the non-literal forms
    (template literals, constants, spreads) that the static extractor would
    silently drop.
  - `@modulato/vite` also dedupes `gsap` now: its ease registry, plugin list and
    globalTimeline are module singletons, so a second copy would silently miss
    declared eases and Tweak's slow-mo.

### Patch Changes

- 31c3d17: Loop applies to whichever Replay button you press. Previously Loop always
  replayed the page intro, so pressing Shell or Motions with Loop on looked
  dead — the press fired, but a one-shot shell intro was immediately drowned by
  the next intro cycle, and Motions on a page without `useMotion` had nothing to
  show. Pressing a Replay button while Loop is on now re-aims the loop at it and
  the progress ring moves to that button; with Loop off the buttons fire once as
  before.

## 0.2.1

### Patch Changes

- da2227d: The overlay ignores the host site's type scale. Shadow DOM does not isolate
  `rem` (it always resolves against the host document's root font-size) and
  `font-size` inherits across the shadow boundary — so sites with custom root
  sizing (62.5% tricks, fluid vw scales) shrank the whole panel. The compiled
  overlay CSS is now rem-free (every rem pinned to px at 16px/rem in the
  build's postprocess step) and mount() pins a 16px base on the shadow root,
  so the overlay renders identically on any host.

## 0.2.0

### Minor Changes

- 1359135: Tweak overlay: precision editing. Dirty rows are now visibly marked (● + accent
  label) so what Save will write is always clear, each dirty row has its own ↺
  reset to undo a stray slider drag without discarding the file's other edits,
  and a filter box narrows long token lists by path — with dirty rows kept
  visible even when they don't match, so a save's payload can never be
  off-screen.

  Core: `motionRegistry.resetLeaf(file, path)` — reset ONE leaf to the file's
  last-known value (backs the overlay's per-row reset; additive, dev-only).

- 17d1397: The token panel now scopes to the current view instead of listing every motion
  file loaded this session: shell (`/motion.ts`), the current page's tokens, and
  transitions touching the current route (`home__about` shows on both `home` and
  `about`; `default` always). A dirty file always stays visible — a pending save
  can never be hidden — and a "show all (+N)" toggle reveals the rest without
  navigating there. Relevance is derived from the file path + current route, no
  core change.
- 731dffc: Redesigned overlay UI on shadcn primitives in a Shadow DOM with precompiled
  CSS — a polished look with zero styling requirements on the host site (no
  Tailwind at runtime, host styles can't bleed in or out). The theme is
  deliberately brand-agnostic: white + shades of gray + black, light-only, all
  Inter (bundled), pill-shaped controls — the overlay lives inside other
  people's designs, so it carries none of its own.

  - Named sections: **Replay** (Intro / Shell / Motions play buttons + a Loop
    switch), **Preview as** (Auto/breakpoint/reduced icons in the header, a
    segmented 0.1x–1x speed control), **Tokens**.
  - Tokens group by parent path under a two-tone header (`shell › menu`), and
    breakpoint/`reduced` override blocks fold into per-group **icon tabs**
    (desktop = base values, phone/tablet, circle-dot-dashed = reduced) instead
    of stacking as separate groups. A non-active tab with unsaved edits carries
    a dot — pending changes are never invisible.
  - Condensed rows: a number is a filled-track slider with its label inside plus
    a fixed-width value box; eases, strings, and booleans are label-inside
    pills. A tweaked row shows a dot on the right that doubles as its per-row
    reset, so a stray drag is visible and individually undoable.
  - Ease fields are a dropdown of the full GSAP catalog, and flavor-aware:
    transition motion files hold CSS/WAAPI easings (offering GSAP names there
    broke the transition — invalid easing → element.animate throws), so
    CSS-flavored fields get the easings.net curve set as labeled cubic-beziers
    while GSAP fields keep the name catalog. Unknown values (project
    CustomEase) are preserved as their own option.
  - Each motion file is a white rounded card on the panel's gray well, with
    per-file Save (N) / Reset and a copy-path button. The filter box (search
    icon, dirty rows exempt) narrows every card; the token list stays scoped to
    the current view with "Show all (+N)"; the launcher pill is now "✦ Tweak".
  - With Loop on, the Intro button's play glyph (the one actually looping)
    becomes a hairline progress ring that fills in sync with each loop cycle:
    the cycle's wall time is measured and drives the next ring (intro durations
    are deterministic), so it tracks the real intro+gap span at any playback
    speed. The first cycle spins indeterminately.

  The overlay bundles Inter (variable latin subset, ~48KB woff2, OFL, dev-only)
  under the private family name 'Inter Tweak', injected into the document head
  (shadow-tree font faces don't load in Chromium) — guaranteed Inter without
  ever shadowing a host site's own Inter faces.

### Patch Changes

- d0ac140: The active speed pill tracks the real playback speed. The highlight now
  subscribes to the core's `modulato:speed` event instead of riding on an
  incidental status-line rerender — clicking 1× right after a save no longer
  looks dead (the click always worked; the highlight just never moved), and a
  speed set externally (MCP `set_speed`) moves the highlight too. The redundant
  "0.5× speed" status message is gone; the highlighted pill is the indicator.

## 0.1.2

### Patch Changes

- 3a57bca: Widen the `modulato` dependency range to any 0.x (`>=0.1.0 <1.0.0`) so a core
  **minor** release no longer forces these packages to a major version bump. Core
  and the framework packages version together on the 0.x line; the range next needs
  revisiting when core reaches 1.0.
