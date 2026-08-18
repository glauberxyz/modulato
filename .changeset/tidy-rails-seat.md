---
'modulato': minor
'@modulato/gsap': minor
---

Shared elements positioned by scroll-driven motion are measured where they
will actually sit.

A page mounts during its own transition, and `useMotion` creates in a passive
effect — which React runs after every layout effect, including the router's
PREPARE, where shared pairs are measured. So at measure time the incoming
page's ScrollTriggers did not exist: no pin, no scrubbed transform, and any
element they position was measured somewhere it will never be. In the demo, a
figure on a pinned horizontal rail returned from its plate inspector to a
target a whole viewport away — the FLIP flew it off the side of the screen.
The asymmetry was the tell: going IN was always correct, because the outgoing
page is fully settled.

Two halves:

- `modulato` gains `onPrepare(fn)` — a hook into the navigation's PREPARE
  moment, called synchronously after the window reaches the incoming page's
  scroll position and before shared elements are measured, with the incoming
  page's root element. It exists so a motion layer can establish scroll-driven
  layout in time to be measured; sites should not need it directly.

- `@modulato/gsap` registers for it: motions that have mounted but not yet
  created (a set that can only contain the incoming page's) are built early,
  inside PREPARE, and the passive effect adopts the result instead of building
  twice. Scrubbed animations are then forced to their trigger's progress, so a
  scrub that would lerp toward its position cannot be measured mid-journey.

Pinning triggers are also no longer disabled while a page transitions. A pin is
not a reaction to scrolling, it is layout — it holds a section against the fold
and gives the document the height that holding costs. Disabled, the section
dropped back into flow and everything below it slid up, so a page that pins
spent its entire transition mis-laid-out and snapped into place on the refresh
that arrives with `active`. Their scrubs are seated during PREPARE and the
window does not move again inside a transition, so leaving them enabled costs
nothing.

`@modulato/gsap` now requires `modulato >= 0.5.0` (peer), where `onPrepare`
first exists.
