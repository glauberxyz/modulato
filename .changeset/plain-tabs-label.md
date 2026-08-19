---
'@modulato/tweak': patch
---

A token group that shows only an override block now says so.

The icon tab strip was gated on there being more than one block with rows —
so it vanished in exactly the two cases where it was the only thing explaining
what you were looking at: a group whose leaves all come from override blocks
with no base sibling, and a query that narrows a group to one block. Either way
`phone` or `reduced` values rendered with nothing to distinguish them from base
values, and editing one looked like editing the default. The strip now shows
whenever there is a choice to make OR the block on screen is not `base`. A
single tab is not redundant; it is the label.

A leaf overridden in BOTH spellings at once — `claim.reduced.amount` and
`reduced.claim.amount` — folds to the same group, block and name, so it renders
as two identical rows of which only one is read. The dead one is dimmed and
titled. Which one is dead is the opposite of what you might expect: the
colocated block merges as the resolver descends and the hoisted one merges at
the outer level afterwards, so the HOISTED value lands last and wins. It is
marked rather than hidden — the value really is in the file, and deleting it
there is the fix.
