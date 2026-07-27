---
'@modulato/tweak': patch
---

Loop applies to whichever Replay button you press. Previously Loop always
replayed the page intro, so pressing Shell or Motions with Loop on looked
dead — the press fired, but a one-shot shell intro was immediately drowned by
the next intro cycle, and Motions on a page without `useMotion` had nothing to
show. Pressing a Replay button while Loop is on now re-aims the loop at it and
the progress ring moves to that button; with Loop off the buttons fire once as
before.
