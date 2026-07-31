---
'modulato': patch
'@modulato/gsap': patch
---

Browser Back/Forward no longer natively yanks the viewport before a
transition runs.

The router set `history.scrollRestoration = 'manual'` in a mount effect —
but GSAP's ScrollTrigger snapshots that property when it initialises and
re-applies the snapshot on every kill/refresh. Route chunks register
ScrollTrigger at module scope, before any effect runs, so the snapshot was
`'auto'` — and the first page unmount silently handed scroll restoration
back to the browser. From then on every traversal (Back button, trackpad
swipe, ⌘←/⌘→) natively restored the destination's old scroll while the
outgoing page was still on screen: a visible jump to the middle of the page,
then the transition's rewind winding it back. Link clicks never traverse,
which is why they were immune.

Three layers, in order of defence:

- `boot()` sets `'manual'` synchronously before route-chunk resolution, so
  ScrollTrigger's snapshot records the right value in the first place.
- `@modulato/gsap` calls `ScrollTrigger.clearScrollMemory('manual')` when it
  wires ScrollTrigger — GSAP's own SPA remedy — repairing the snapshot even
  when ScrollTrigger initialised early some other way.
- The router's popstate handler undoes any native restore that lands anyway
  (Safari has historically restored on gesture navigations regardless):
  scroll events lag a native restore by a frame, so at popstate time the
  last scroll-event position is still the reader's true one — the handler
  writes it back in the same task, before the restore can paint, and before
  scroll memory records the corrupted value as the outgoing page's own.
