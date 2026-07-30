---
'@modulato/gsap': patch
---

`useMotion` now disables a page's ScrollTriggers while it is entering or
leaving, and re-enables them when it becomes active.

A transition scrolls the WINDOW — to land the incoming page, to lift the
outgoing one into its overlay — but a page being transitioned has not moved
under the reader at all. Left enabled, its triggers read that jump as
scrolling and fire: in the demo, a chapter's entire body revealed itself in
the moment before it flew away, on a window scroll that went 0 to 1501 in one
step.

Pairs with the refresh already done on `active`: positions are recomputed once
the page has really settled, and nothing fires against a scroll position that
was never the reader's.
