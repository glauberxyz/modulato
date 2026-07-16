# modulato

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
