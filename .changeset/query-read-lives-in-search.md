---
'modulato': minor
---

Add `useSearchParams()` and `readSearchParams()` — the whole query, reactive to the same
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
