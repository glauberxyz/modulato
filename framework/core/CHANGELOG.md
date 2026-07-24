# modulato

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
