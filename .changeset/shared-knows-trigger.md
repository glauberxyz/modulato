---
'modulato': minor
---

Shared pairs say which ones the reader actually triggered.

A shared id is a VALUE, so the same id legitimately appears on more than one
surface — a list naming every item, and a "next item" card at the foot of each.
Both then match on a single navigation and the transition receives pairs for
something nobody touched. In the demo, moving from the index to a chapter
collected six pairs where two were wanted: the other four were a different
chapter's index entry matching the next-chapter card at the destination's tail.

The surplus is worse than extra motion. Anything measuring a bounding span
across the set silently aims at the wrong region — both of the demo's scroll
helpers broke, one seating the incoming page at its bottom and the other
concluding the words were already visible and declining to scroll, and neither
failure points anywhere near shared elements.

`SharedPair` now carries `withinTrigger`: the outgoing element sits inside the
element that started the navigation. The list is sorted with those first, so a
transition taking the first pair gets the one the reader touched. That replaces
matching on the site's own class names, which is what the demo was reduced to.

It is false for every pair when there is no trigger — a popstate, or a
programmatic `navigate()` — so test it rather than assuming it partitions the
set. A site whose ids genuinely collide still has to disambiguate those paths
itself; the demo does, for the one direction that has no trigger.
