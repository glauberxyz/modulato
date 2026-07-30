---
'@modulato/tweak': patch
---

The overlay folds breakpoint/`reduced` override blocks into a group's icon
tabs wherever the override segment sits in the path, not only when it is the
leaf's immediate parent.

`resolveTokens` treats override keys as reserved at every nesting level, so
`claim.reduced.amount` and `reduced.claim.amount` resolve identically — but
the overlay only folded the first spelling. A hoisted block, or an override
carrying a nested group (`enter.phone.tint.duration`), rendered as a separate
card named after the override (`intro › reduced › claim`,
`flight › back › phone › contents`) instead of landing in the real group's
phone/reduced tab. The fold now matches the resolver: the override segment
nearest the leaf names the tab, and the group is the path without it. Rows
keep their original paths, so editing, dirty-tracking and Save write back to
wherever the block actually lives in the source.
