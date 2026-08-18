---
'modulato': patch
---

`flipShared` carries the source's content styling onto the clone, so an image
no longer stretches on the way across.

The clone is reparented to `<body>` to fly as a fixed overlay. It keeps its own
class names — which the doc comment offered as the reason CSS still applies —
but that only holds when the styling is on the element itself. The usual way to
style an image is through its container (`.figure img { object-fit: contain }`),
and every one of those rules stops matching the moment the clone leaves that
container.

What it looks like is a stretch. A FLIP animates width and height
independently, so unless the two rects happen to share an aspect ratio the box
travels through shapes the picture never has; at `object-fit`'s default of
`fill` the image distorts across the whole flight and snaps correct on arrival.
In the demo a portrait plate morphing into a full-bleed inspector visibly
widened and squashed halfway over.

`object-fit`, `object-position` and `border-radius` are now read from the
source's computed style — whichever selector actually got there — and written
onto the clone before it flies.
