# @modulato/gsap

## 0.3.0

### Minor Changes

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

- ed055ff: A page's scroll-triggered animations no longer fire while it is still
  transitioning.

  `gsap.from(..., { scrollTrigger })` starts the instant its trigger is BUILT, if
  the start line is already crossed — and building happens at mount, which is
  mid-transition. Whether a page noticed was an accident of its own height: in the
  demo, a chapter whose head was short enough to put the first section above the
  line played its entire reveal behind the flight, while a taller one missed the
  line and looked correct for no better reason than layout.

  `useMotion` now holds what it creates while its page is not active: anything a
  trigger has already started is wound back and paused, and the triggers are
  disabled until the page arrives. Pins are excepted — they are layout, not a
  reaction to scrolling — and so are scrubs, which were seated deliberately during
  PREPARE and would be undone by winding back.

  Pairs with the refresh already done on `active`: nothing fires against a scroll
  position that was never the reader's, and everything re-evaluates once the page
  has really settled. The demo deletes the per-page hold it was carrying to work
  around this.

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

- b7c4ec7: `useMotion` now refreshes ScrollTrigger once its page becomes active.

  A page mounts **during** its own transition: the outgoing page is still in the
  document as an absolute overlay, the incoming one may still be hidden, and the
  scroll position is not final. Every ScrollTrigger created inside `useMotion`
  cached its start/end against that arrangement, and nothing ever recomputed
  them — so scroll reveals fired against positions that were wrong by however
  much the outgoing page contributed to the document height.

  It showed up as scroll-triggered content behaving differently from page to
  page: sections that stayed hidden until you scrolled, or that arrived already
  revealed with their animation skipped. In the demo, five of eight triggers on
  a chapter reached by transition were 405px off.

- 80b25da: `useMotion` now disables a page's ScrollTriggers while it is entering or
  leaving, and re-enables them when it becomes active.

  A transition scrolls the WINDOW — to land the incoming page, to lift the
  outgoing one into its overlay — but a page being transitioned has not moved
  under the reader at all. Left enabled, its triggers read that jump as
  scrolling and fire: in the demo, a chapter's entire body revealed itself in
  the moment before it flew away, on a window scroll that went 0 to 1501 in one
  step.

  Pairs with the refresh already done on `active`: positions are recomputed once
  the page has really settled, and nothing fires against a scroll position that
  was never the reader's.

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

## 0.1.2

### Patch Changes

- 3a57bca: Widen the `modulato` dependency range to any 0.x (`>=0.1.0 <1.0.0`) so a core
  **minor** release no longer forces these packages to a major version bump. Core
  and the framework packages version together on the 0.x line; the range next needs
  revisiting when core reaches 1.0.
