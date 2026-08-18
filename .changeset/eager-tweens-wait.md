---
'@modulato/gsap': patch
---

A page's scroll-triggered animations no longer fire while it is still
transitioning.

`gsap.from(..., { scrollTrigger })` starts the instant its trigger is BUILT, if
the start line is already crossed — and building happens at mount, which is
mid-transition. Whether a page noticed was an accident of its own height: in the
demo, a chapter whose head was short enough to put the first section above the
line played its entire reveal behind the flight, while a taller one missed the
line and looked correct for no better reason than layout.

`useMotion` now holds what it creates while its page is not active: anything a
trigger has already started is wound back and paused, and the triggers are
disabled until the page arrives. Pins are excepted — they are layout, not a
reaction to scrolling — and so are scrubs, which were seated deliberately during
PREPARE and would be undone by winding back.

Pairs with the refresh already done on `active`: nothing fires against a scroll
position that was never the reader's, and everything re-evaluates once the page
has really settled. The demo deletes the per-page hold it was carrying to work
around this.
