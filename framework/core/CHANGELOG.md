# modulato

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
