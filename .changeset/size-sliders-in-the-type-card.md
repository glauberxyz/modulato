---
'@modulato/tweak': minor
'create-modulato': patch
---

Type Mode's card can move the size, not only pick it

The card you get by clicking text had a size select and nothing else: it chose
which `scale` step a style wears, and the numbers behind the step were only in
the panel's Typography tab. That was the design — a scale is tuned once, a style
only picks from it — and in use the number that turns out to be wrong is the one
on the heading you just clicked.

Under the select there are now sliders for those numbers: one for a fixed size,
two side by side for a fluid `{ min, max }` pair. They edit the step itself
(`scale.display.min`), not the style, so the scale stays a closed set — every
style set in that step moves together, and the card names the others when there
are any. In the class tab it says so too, since a step is never one class's to
move. A size written inline is edited where it is written; one that is raw CSS
has no number to move and says to edit `type.ts`.

The card also measures its own height before placing itself. It assumed 220px
and was already taller, so for text in the lower part of the window Save and
Reset sat below the fold, and a card placed above a heading covered it.
