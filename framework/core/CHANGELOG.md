# modulato

## 0.13.0

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

## 0.12.0

### Minor Changes

- 2ef5989: The styleguide is a framework page: `modulato/styleguide`

  `create-modulato` has scaffolded a `/styleguide` page since typography tokens
  landed, and it was 200 lines of project-owned JSX and SCSS styled with the
  site's own type mixins and colour variables. That made it a page of the site
  as far as any agent was concerned, and every agent that implemented a design
  re-skinned it along with the rest of `pages/` — starting by rewriting
  `color.ts`, at which point the page's `var(--rule)` named nothing, it looked
  broken, and "fix it" meant "redesign it". Two projects, two layouts. The demo
  had a third.

  The markup and the chrome now ship with the framework, from a new
  `modulato/styleguide` export, and the scaffolded page is one component call:

  ```tsx
  import { Styleguide } from "modulato/styleguide";
  import type from "../../type";
  import colors from "../../color";

  export default () => <Styleguide type={type} colors={colors} />;
  ```

  The look is Modulato's and not the project's — a white page, shades of gray,
  the same bundled Inter the Tweak overlay renders in, every length in px so a
  site's root font size cannot scale it — and it is the same in every project.
  It is light DOM rather than a shadow root, because the specimens exist to
  render through the document's `.type-*` rules, variables, media queries and
  loaded fonts, none of which cross a shadow boundary; the stylesheet defends
  itself the way an embedded widget does instead.

  What it shows, all read and never restated: the type styles (the authored
  fields on one line, breakpoint blocks and the fluid range included, each named
  by its `--type-<style>-size` variable), the palette, the declared eases as
  drawn curves, and the breakpoints. The side nav marks the section being read.

  What is deliberately NOT on it: the motion tokens, a table of the `scale`
  steps, a list of the `fonts` stacks. A step is the size of some style already
  and a stack is the face it is set in — both are on show in the specimens, and
  a second table of the same facts is a second place to read one thing. Motion
  numbers have no shape on a sheet; they are worked on live in the overlay (✦),
  against the animation they drive.

  The type specimens are set the way a foundry sets one: the **same paragraph**
  for every style in a box of one height, clamped with an ellipsis, so a big
  style fills it in two lines and a small one in a dozen — the amount you can
  read IS the size, and the leading, the line breaks and the wrapping are on
  show rather than described. The sheet deliberately says **nothing about what a
  style is for**: where a style gets used is the project's decision, and an
  agent inventing that copy is how a specimen sheet turns into volumes of text
  nobody asked for.

  `Section` from the same module adds a project's own sections in the same
  chrome, listed in the side nav automatically. Delete `pages/styleguide/` and
  the Menu entry to opt out, as before.

  The site's shell steps aside on the page. The sheet's root carries
  `data-modulato-styleguide`, and the scaffolded `styles/global.scss` hides the
  menu on it with `body:has([data-modulato-styleguide]) .menu { display: none }`
  — CSS rather than a route check in the shell component, so it is already true
  in the SSR HTML and the project keeps the last word about its own shell. The
  sheet carries a "Back to site" link of its own.

  **Upgrading an existing project** is three steps — swap `page.tsx` for the
  component call, delete the page's `styles.scss`, add the `body:has(…)` rule —
  and nothing breaks in the meantime, because the old page is the project's own
  code reading its own tokens. `modulato check` gained two warnings that say so
  with the steps in the message, since a stale styleguide is invisible otherwise:
  the dead stylesheet stays auto-imported, and the next agent to implement a
  design re-skins the page, which is the thing this change exists to stop.

  `viewportStore.breakpoints()` is new — the configured map, for a client that
  wants to print it.

### Patch Changes

- 2ef5989: `modulato check`: warn when a fluid size is hand-written

  A size written as `clamp(0.75rem, 1vw, 1.25rem)` is legal and passed through
  untouched, which is exactly why it needed saying. The commonest way into a
  Modulato project is porting one, and the thing being ported is a stylesheet
  full of already-solved clamps — translating them across verbatim is the obvious
  move and the wrong one. The string still renders, but it encodes a viewport
  range its author never wrote down, and it reaches Tweak as one value the
  overlay can name but not move, where `{ min, max }` is two numbers with a
  slider each.

  The ends are recoverable from a plain `clamp(A, …, B)`, so the warning says
  what to write rather than only what is wrong:

  ```
  type.ts  scale step `xs` is a hand-written fluid size. Write its two ends
           instead — `xs: { min: 12, max: 20 }` — and state the viewport range
           once in `fluid`.
  ```

  Scale steps and a style's own `size` are both checked. MODULATO.md and the
  scaffolded CLAUDE.md say the same thing about porting, where prose alone had
  been permissive: "still works, still passed through untouched" reads as
  permission when you are translating a legacy system.

## 0.11.0

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

## 0.10.0

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

## 0.9.0

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

## 0.8.0

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

## 0.7.0

### Minor Changes

- 80ed173: Add `useSearchParams()` and `readSearchParams()` — the whole query, reactive to the same
  shallow writes and Back/Forward as `useSearchParam`, so a page can read it in render instead
  of reaching for `location.search`.

  `RouteInfo` deliberately gains no `query`. It is also the contract handed to transitions,
  intros and enhancers, which run at a moment rather than across renders: a query snapshotted
  there is stale from the first `setSearchParam`, and a live one read there changes with no
  re-render. The query stays in the store that already owns it.

  Also documents the query for the first time — `useSearchParam` shipped in 0.2.0 with no
  reference at all — including the rule that makes deep links work: the query is client state,
  empty on the server and through hydration, so apply it in an effect and never as a `useState`
  seed.

## 0.6.0

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

- d0ff799: Shared pairs say which ones the reader actually triggered.

  A shared id is a VALUE, so the same id legitimately appears on more than one
  surface — a list naming every item, and a "next item" card at the foot of each.
  Both then match on a single navigation and the transition receives pairs for
  something nobody touched. In the demo, moving from the index to a chapter
  collected six pairs where two were wanted: the other four were a different
  chapter's index entry matching the next-chapter card at the destination's tail.

  The surplus is worse than extra motion. Anything measuring a bounding span
  across the set silently aims at the wrong region — both of the demo's scroll
  helpers broke, one seating the incoming page at its bottom and the other
  concluding the words were already visible and declining to scroll, and neither
  failure points anywhere near shared elements.

  `SharedPair` now carries `withinTrigger`: the outgoing element sits inside the
  element that started the navigation. The list is sorted with those first, so a
  transition taking the first pair gets the one the reader touched. That replaces
  matching on the site's own class names, which is what the demo was reduced to.

  It is false for every pair when there is no trigger — a popstate, or a
  programmatic `navigate()` — so test it rather than assuming it partitions the
  set. A site whose ids genuinely collide still has to disambiguate those paths
  itself; the demo does, for the one direction that has no trigger.

## 0.5.0

### Minor Changes

- eeb32a1: `scroll: { restore: false }` now means the page opens at the top on Back and
  Forward too, and `navigate()` takes a per-navigation override.

  `restore` only ever governed link navigations — Back/Forward restored the
  stored position regardless. That left no way to say "this page always opens at
  its head", which is what a page with a choreographed opening needs: a restored
  scroll puts the choreography somewhere nobody can see, and the router and the
  transition then write the scroll position twice in one navigation, across an
  await, so a frame can land between them.

  - `restore: true` — unchanged. Link navigations and Back/Forward both restore.
  - `restore: false` — the page always opens at the top, Back and Forward
    included. **Behaviour change**: previously indistinguishable from omitting it.
  - omitted — unchanged. Link navigations start at the top, Back/Forward restore.

  `navigate(path, { restoreScroll: true })` overrides whatever the destination
  declares, for one navigation — how a detail view returns the reader to the
  exact place in the list it was opened from, even when that list opens at the
  top by default.

  **Reach for `restore: false` less often than it sounds.** A traversal already
  carries the position that history entry was left at, and `restore: false`
  outranks it — so a page that opens a child view (a detail, a lightbox, an
  inspector) sends the reader back to its head when they press Back, discarding a
  position the router was holding for them. Omitting `restore` is usually what a
  choreographed opening actually wants: link navigations still start at the top,
  while a traversal restores, and an entry the reader has never left carries no
  position to restore anyway. `restore: false` is for the narrower case where the
  top is right even when the reader is coming back to somewhere they had been.

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

- a24f23c: Shared elements positioned by scroll-driven motion are measured where they
  will actually sit.

  A page mounts during its own transition, and `useMotion` creates in a passive
  effect — which React runs after every layout effect, including the router's
  PREPARE, where shared pairs are measured. So at measure time the incoming
  page's ScrollTriggers did not exist: no pin, no scrubbed transform, and any
  element they position was measured somewhere it will never be. In the demo, a
  figure on a pinned horizontal rail returned from its plate inspector to a
  target a whole viewport away — the FLIP flew it off the side of the screen.
  The asymmetry was the tell: going IN was always correct, because the outgoing
  page is fully settled.

  Two halves:

  - `modulato` gains `onPrepare(fn)` — a hook into the navigation's PREPARE
    moment, called synchronously after the window reaches the incoming page's
    scroll position and before shared elements are measured, with the incoming
    page's root element. It exists so a motion layer can establish scroll-driven
    layout in time to be measured; sites should not need it directly.

  - `@modulato/gsap` registers for it: motions that have mounted but not yet
    created (a set that can only contain the incoming page's) are built early,
    inside PREPARE, and the passive effect adopts the result instead of building
    twice. Scrubbed animations are then forced to their trigger's progress, so a
    scrub that would lerp toward its position cannot be measured mid-journey.

  Pinning triggers are also no longer disabled while a page transitions. A pin is
  not a reaction to scrolling, it is layout — it holds a section against the fold
  and gives the document the height that holding costs. Disabled, the section
  dropped back into flow and everything below it slid up, so a page that pins
  spent its entire transition mis-laid-out and snapped into place on the refresh
  that arrives with `active`. Their scrubs are seated during PREPARE and the
  window does not move again inside a transition, so leaving them enabled costs
  nothing.

  `onPrepare` arrives in `modulato@0.5.0`, and `@modulato/gsap` needs it for the
  seating above. The peer range stays wide (`>=0.1.0 <1.0.0`) — CONTRIBUTING keeps
  it that way so a core minor does not cascade the plugins to 1.0.0 — so npm will
  not enforce the pairing. Instead the hook is read off a namespace import rather
  than named: against an older core it is simply absent, the PREPARE seating is
  skipped, and everything else in the package still works. Upgrade both together
  to get it.

### Patch Changes

- 8ac847d: A leaving page's Lenis is stopped before the router repositions the window,
  not one paint after.

  The stop lived in a passive effect, but the router parks the window at the
  incoming page's scroll position in a pre-paint layout effect — so for at
  least one frame the outgoing page's Lenis was still live while the window
  jumped under it. A Lenis mid-glide (trackpad momentum, `isScrolling:
'smooth'`) refuses to adopt a native jump, and its next raf dragged the
  window back toward its own target: a visible yank toward wherever the reader
  had been scrolling, after which `stop()` adopted the wrong position and the
  whole transition ran from there.

  The start/stop toggle is now a layout effect. Child effects run before the
  parent's, so the page's Lenis has always let go — reset to the actual scroll,
  animation killed — by the time the router's own layout effect moves the
  window. Traced before/after on a Back navigation: the stop now precedes
  `prepareOutgoing`'s scroll write instead of trailing it.

- c4186d3: Browser Back/Forward no longer natively yanks the viewport before a
  transition runs.

  The router set `history.scrollRestoration = 'manual'` in a mount effect —
  but GSAP's ScrollTrigger snapshots that property when it initialises and
  re-applies the snapshot on every kill/refresh. Route chunks register
  ScrollTrigger at module scope, before any effect runs, so the snapshot was
  `'auto'` — and the first page unmount silently handed scroll restoration
  back to the browser. From then on every traversal (Back button, trackpad
  swipe, ⌘←/⌘→) natively restored the destination's old scroll while the
  outgoing page was still on screen: a visible jump to the middle of the page,
  then the transition's rewind winding it back. Link clicks never traverse,
  which is why they were immune.

  Three layers, in order of defence:

  - `boot()` sets `'manual'` synchronously before route-chunk resolution, so
    ScrollTrigger's snapshot records the right value in the first place.
  - `@modulato/gsap` calls `ScrollTrigger.clearScrollMemory('manual')` when it
    wires ScrollTrigger — GSAP's own SPA remedy — repairing the snapshot even
    when ScrollTrigger initialised early some other way.
  - The router's popstate handler undoes any native restore that lands anyway
    (Safari has historically restored on gesture navigations regardless):
    scroll events lag a native restore by a frame, so at popstate time the
    last scroll-event position is still the reader's true one — the handler
    writes it back in the same task, before the restore can paint, and before
    scroll memory records the corrupted value as the outgoing page's own.

- dee0144: Back and Forward during a transition no longer desync the URL from the page.

  The popstate handler ignores a traversal whose path matches the page already on
  screen — that guard is for a query or hash change pushed by `useSearchParam`,
  which must not re-resolve or remount anything. It compared against
  `state.current`, and during an uncommitted transition `current` is still the
  page being animated AWAY: the address bar was pushed to the destination when the
  navigation started.

  So a traversal back to the outgoing page looked like a query-only change and was
  dropped. The URL became the old path while the app carried on committing the new
  one, and the two disagreed until the next navigation — reproducible by stalling
  a transition and pressing Back, and easy to hit for real on a slow connection or
  with a long transition.

  The comparison is now against the pending entry when there is one, which is what
  the URL is actually showing. A genuine traversal mid-transition cancels the
  in-flight one and starts its own — the reader has asked for a different
  destination than the one being animated to, and finishing that first would land
  them on a page they have already left. That needed no new machinery: `navigate`
  takes a fresh token, and the transition effect's cleanup marks the running one
  cancelled as soon as the pending entry changes.

- dabe9db: `flipShared` carries the source's content styling onto the clone, so an image
  no longer stretches on the way across.

  The clone is reparented to `<body>` to fly as a fixed overlay. It keeps its own
  class names — which the doc comment offered as the reason CSS still applies —
  but that only holds when the styling is on the element itself. The usual way to
  style an image is through its container (`.figure img { object-fit: contain }`),
  and every one of those rules stops matching the moment the clone leaves that
  container.

  What it looks like is a stretch. A FLIP animates width and height
  independently, so unless the two rects happen to share an aspect ratio the box
  travels through shapes the picture never has; at `object-fit`'s default of
  `fill` the image distorts across the whole flight and snaps correct on arrival.
  In the demo a portrait plate morphing into a full-bleed inspector visibly
  widened and squashed halfway over.

  `object-fit`, `object-position` and `border-radius` are now read from the
  source's computed style — whichever selector actually got there — and written
  onto the clone before it flies.

## 0.4.0

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

## 0.3.0

### Minor Changes

- 0c72f30: Dev slow-mo now reaches ticker-driven animation. `useTicker` callbacks run on
  the motion clock: `delta` scales with the Tweak Mode speed and `time` advances
  by the scaled deltas, so frame-loop motion (canvas spins, WebGL scenes) slows
  together with GSAP and WAAPI instead of ignoring the speed pills. The raw
  `ticker.add()` loop is unscaled — Lenis smooth-scroll and other input
  smoothing stay realtime — and production behavior is unchanged.
- 1359135: Tweak overlay: precision editing. Dirty rows are now visibly marked (● + accent
  label) so what Save will write is always clear, each dirty row has its own ↺
  reset to undo a stray slider drag without discarding the file's other edits,
  and a filter box narrows long token lists by path — with dirty rows kept
  visible even when they don't match, so a save's payload can never be
  off-screen.

  Core: `motionRegistry.resetLeaf(file, path)` — reset ONE leaf to the file's
  last-known value (backs the overlay's per-row reset; additive, dev-only).

## 0.2.1

### Patch Changes

- cb79d21: `modulato dev` now loads `.env` / `.env.local` into `process.env` at startup, so a
  server-side `load()` (SSR on first paint) sees the same variables a credentialed
  content adapter does — Vite only exposes dotenv via `import.meta.env`, not
  `process.env`. This is the dev-runtime sibling of the same fix for `modulato content`:
  a loader that reads `process.env.MY_API_URL` on the server now resolves under
  `modulato dev` without a `vite.config` shim. Precedence unchanged — a variable already
  in the real environment wins, and `.env.local` overrides `.env`.

## 0.2.0

### Minor Changes

- 8a1bd2a: Add `useSearchParam` / `setSearchParam` for URL-backed UI state (overlays,
  tabs, filters) that lives in the query string instead of a route. Reading is
  reactive; writing does a shallow history update that does NOT re-resolve or
  remount the page — so opening an overlay keeps the page, its scroll, and its
  canvases in place.

  ```ts
  const [company, setCompany] = useSearchParam("company");
  setCompany("aero"); // pushState — Back closes the overlay
  setCompany(null); // removes the param
  setCompany("layer", { replace: true }); // swap with no new history entry
  ```

  Related fix: a Back/Forward navigation that changes only the query or hash on
  the current page no longer re-resolves and remounts the page — the router now
  treats a same-pathname popstate as a shallow update.

### Patch Changes

- 9b927a0: `modulato content` now loads `.env` and `.env.local` before running the content
  adapter. The CLI is a plain Node process (not the Vite dev server), so a
  credentialed adapter — Sanity, Contentful, anything reading `process.env` in
  `pull()` — previously received `undefined` for vars a developer had put in a
  dotenv file. Precedence follows the usual convention: a variable already
  exported in the environment wins; among files, `.env.local` overrides `.env`.
- acd438d: Build-time content refresh (`refetchOnBuild`). Opt in with `refetchOnBuild: true`
  in `modulato.config.ts` to re-run the content adapter's `pull()` at the start of
  `modulato build`, so a deploy ships freshly pulled content instead of the committed
  snapshot — the loop a CMS-backed site wants (publish → deploy hook → rebuild → fresh
  content). Off by default, so existing builds stay reproducible and credential-free.
  A pull failure at build warns and falls back to the committed snapshot;
  `modulato build --no-content` forces the snapshot and `--refetch` forces a pull even
  when the flag is off. Works with any adapter (local JSON, a CMS API, a database) —
  it just changes _when_ `pull()` runs.
