---
'@modulato/gsap': patch
---

`useMotion` now refreshes ScrollTrigger once its page becomes active.

A page mounts **during** its own transition: the outgoing page is still in the
document as an absolute overlay, the incoming one may still be hidden, and the
scroll position is not final. Every ScrollTrigger created inside `useMotion`
cached its start/end against that arrangement, and nothing ever recomputed
them — so scroll reveals fired against positions that were wrong by however
much the outgoing page contributed to the document height.

It showed up as scroll-triggered content behaving differently from page to
page: sections that stayed hidden until you scrolled, or that arrived already
revealed with their animation skipped. In the demo, five of eight triggers on
a chapter reached by transition were 405px off.
