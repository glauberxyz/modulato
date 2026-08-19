---
'modulato': minor
---

Add `useSearchParams()` — the whole query as `{ key: value }`, reactive to the
same shallow writes and Back/Forward as `useSearchParam`, so a page can read the
query in render instead of reaching for `location.search`.

`RouteInfo` deliberately still has no `query`. A route entry is resolved once per
navigation and a query write is SHALLOW by design (no re-resolve, no remount —
that is what keeps overlays, scroll and canvases alive), so a `query` copied onto
the entry would be stale the moment anything set a param, and a query-only link
never re-resolves at all. The query is client state and lives with the store that
already owns it.

Both hooks read empty on the server AND during hydration: a deep-linked param
arrives one render later, so react to it in an effect rather than seeding
`useState` from it.
