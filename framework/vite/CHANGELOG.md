# @modulato/vite

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
