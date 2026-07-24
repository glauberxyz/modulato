---
'@modulato/tweak': patch
---

The overlay ignores the host site's type scale. Shadow DOM does not isolate
`rem` (it always resolves against the host document's root font-size) and
`font-size` inherits across the shadow boundary — so sites with custom root
sizing (62.5% tricks, fluid vw scales) shrank the whole panel. The compiled
overlay CSS is now rem-free (every rem pinned to px at 16px/rem in the
build's postprocess step) and mount() pins a 16px base on the shadow root,
so the overlay renders identically on any host.
