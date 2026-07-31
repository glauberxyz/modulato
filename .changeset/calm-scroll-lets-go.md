---
'modulato': patch
---

A leaving page's Lenis is stopped before the router repositions the window,
not one paint after.

The stop lived in a passive effect, but the router parks the window at the
incoming page's scroll position in a pre-paint layout effect — so for at
least one frame the outgoing page's Lenis was still live while the window
jumped under it. A Lenis mid-glide (trackpad momentum, `isScrolling:
'smooth'`) refuses to adopt a native jump, and its next raf dragged the
window back toward its own target: a visible yank toward wherever the reader
had been scrolling, after which `stop()` adopted the wrong position and the
whole transition ran from there.

The start/stop toggle is now a layout effect. Child effects run before the
parent's, so the page's Lenis has always let go — reset to the actual scroll,
animation killed — by the time the router's own layout effect moves the
window. Traced before/after on a Back navigation: the stop now precedes
`prepareOutgoing`'s scroll write instead of trailing it.
