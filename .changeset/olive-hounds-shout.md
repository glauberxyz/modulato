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

**Reach for `restore: false` less often than it sounds.** A traversal already
carries the position that history entry was left at, and `restore: false`
outranks it — so a page that opens a child view (a detail, a lightbox, an
inspector) sends the reader back to its head when they press Back, discarding a
position the router was holding for them. Omitting `restore` is usually what a
choreographed opening actually wants: link navigations still start at the top,
while a traversal restores, and an entry the reader has never left carries no
position to restore anyway. `restore: false` is for the narrower case where the
top is right even when the reader is coming back to somewhere they had been.
