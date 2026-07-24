# @modulato/tweak

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
