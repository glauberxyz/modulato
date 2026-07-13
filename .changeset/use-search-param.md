---
'modulato': minor
---

Add `useSearchParam` / `setSearchParam` for URL-backed UI state (overlays,
tabs, filters) that lives in the query string instead of a route. Reading is
reactive; writing does a shallow history update that does NOT re-resolve or
remount the page — so opening an overlay keeps the page, its scroll, and its
canvases in place.

```ts
const [company, setCompany] = useSearchParam('company')
setCompany('aero')                    // pushState — Back closes the overlay
setCompany(null)                      // removes the param
setCompany('layer', { replace: true }) // swap with no new history entry
```

Related fix: a Back/Forward navigation that changes only the query or hash on
the current page no longer re-resolves and remounts the page — the router now
treats a same-pathname popstate as a shallow update.
