# @modulato/vite

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

## 0.4.0

### Minor Changes

- c6d364d: Give the server the request: cookie auth is now possible.

  Nothing on the server could see the request. SSR was `handle(url)` — a URL
  string, no headers — and an action got `{ form }` only, so it could neither
  read a cookie nor set one. Any site with a session had to resolve every
  authenticated view client-side after mount, a round trip and a skeleton each.

  Three additions, smallest surface first:

  - **Actions get `request` and `cookies`.** `action(async ({ form, request, cookies }) => …)`
    with `cookies.get/getAll/set/delete`. Writes flush onto the response when
    the handler returns, including when it **throws** — an action that clears a
    session and then rejects still clears it. `path` defaults to `/`, without
    which a cookie set by an action would be scoped to `/__modulato/action/…`
    and invisible to every page. This alone unblocks sign-in.
  - **`load()` gets `ctx.request` — server-only.** Present on the first paint,
    `undefined` on client navigations, because `load()` runs in both places.
    `modulato check` now ERRORS on a `load()` that reads it without a guard:
    unguarded it throws on the first link click and not before, which is the one
    order nobody tests in.
  - **A `response` hook in `modulato.config.ts`.** Runs once per SSR request
    before the page renders — the only place to set a response header or a
    cookie on a page load. Applied identically by the dev middleware and the
    Vercel function.

  `handle(url)` still works; `render()` now also returns `headers`, which
  callers must apply (`applyHeaders`). `@modulato/server` exports `nodeRequest`,
  `requestUrl`, `requestHeaders`, `applyHeaders`, `createCookies`,
  `parseCookieHeader` and `serializeCookie`.

- c6d364d: Vercel output: runtime follows the build, and the build output is extensible.

  - The SSR function was hardcoded to `nodejs22.x`, so a project on Node 24
    silently deployed onto 22. It now uses **the Node major that ran the
    build**, and an unknown major clamps to the newest runtime this version
    knows about with a warning rather than shipping a string Vercel rejects.
  - `emitVercelOutput()` wiped `.vercel/output` entirely and wrote one fixed
    route table, so a project needing its own function had to read the generated
    JSON back and splice a route into it. Modulato now removes only what it owns
    (`static/`, `functions/__ssr.func`, `config.json`), leaving any other
    function in place.

  Both are configurable: `modulato({ vercel: { runtime, routes } })`. Caller
  routes merge after the asset cache headers and before `handle: filesystem` —
  the only window where a project's own function can win a path. `vercel: true`
  still works.

### Patch Changes

- c6d364d: Dev no longer 404s a request whose `Accept` is not HTML.

  `curl http://localhost:5173/` returned `Cannot GET /` in dev and 200 in
  production — same URL, same build, opposite answers. The SSR middleware gated
  on `Accept: text/html`, and `*/*` is what curl, wget, health checks, uptime
  monitors and most shell scripts send, so the first thing anyone does to check
  a dev server looked like a broken route.

  It now matches the request PATH instead — asset-shaped paths (`/@vite/`,
  `/@fs/`, `/@id/`, `/node_modules/`, an extension on the last segment) fall
  through to Vite's own middleware, everything else is served as a page. An
  explicit `text/html` still wins, so a real route with a dot in its last
  segment (`/blog/v1.2-release`) is served while a missing `/logo.png` keeps
  getting Vite's asset 404 rather than a page with a 200.

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
