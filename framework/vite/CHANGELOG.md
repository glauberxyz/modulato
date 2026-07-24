# @modulato/vite

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
