---
'modulato': minor
---

`scroll: { restore: false }` now means the page opens at the top on Back and
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
