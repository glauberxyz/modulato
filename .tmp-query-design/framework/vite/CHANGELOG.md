# @modulato/vite

## 0.3.0

### Minor Changes

- 63bec8a: The content snapshot is fetched on the first client navigation instead of
  shipping in the entry bundle.

  `virtual:modulato/content` was imported eagerly by the generated client entry,
  so the whole snapshot sat in the one chunk every route loads before anything
  else — every visitor downloaded every route's content to see one page. It is
  not needed then: the first page hydrates from props SSR already sent, and
  `resolveEntry` only touches the snapshot when it has to RUN a route's `load()`,
  which happens on client navigations and never on first paint.

  `boot({ content })` and `<Root content>` now accept a `ContentSource` — the
  snapshot object as before, or a function returning it. `@modulato/vite` passes
  a dynamic import, so the snapshot becomes its own chunk: absent from the entry,
  not preloaded, fetched on the first link click and memoised for every
  navigation after. The server entry keeps its eager import, where there is no
  download to pay for.

  In the demo this moves 21 KB out of a 313 KB entry chunk. The saving scales
  with the content, not the code — a site with a few hundred entries is where it
  stops being cosmetic.

  Passing a plain object still works, so existing `boot()` calls are unaffected.

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

- 8b6a5fe: Stamp `data-modulato-source="/pages/home/page.tsx:12:5"` on every host element in dev.

  Dev's JSX runtime is already handed the file, line and column of every element it
  creates; React keeps it on the fiber, where only devtools can read it. This copies it
  into the DOM, which is where an inspector, the Tweak overlay, and an agent reading a
  page are all actually looking — collapsing "read a DOM snapshot, guess which component
  rendered that node, grep for a class name" into a read.

  It works by pointing a project file's JSX runtime import at a thin wrapper, so it lands
  identically in the SSR HTML and in client-rendered updates, and no component can swallow
  it by not spreading props. Production compiles to a different JSX runtime, so not a byte
  of it ships. Opt out with `modulato({ sourceAttribute: false })`.

## 0.2.1

### Patch Changes

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

## 0.2.0

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

## 0.1.3

### Patch Changes

- 56e2361: Two consumer-reported fixes:

  - The ✦ Tweak button appears again in consuming apps on `@modulato/tweak`
    0.2.0. The overlay is served from source (`optimizeDeps.exclude`), so the
    scanner never saw its transitive deps: `@base-ui/react` imports
    `use-sync-external-store`'s CJS shims, whose conditional
    `module.exports = require(…)` hides the named exports unless the optimizer
    pre-bundles them with interop — the overlay module threw on import and
    `mount()` never ran. The plugin now pushes both shims into
    `optimizeDeps.include` whenever Tweak is enabled, so no per-app
    `vite.config` workaround is needed.
  - Vite 8 allowed: peer range widened to `^6 || ^7 || ^8` (unblocks
    `@vitejs/plugin-react@6`).
