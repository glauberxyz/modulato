---
'modulato': minor
---

Dev slow-mo now reaches ticker-driven animation. `useTicker` callbacks run on
the motion clock: `delta` scales with the Tweak Mode speed and `time` advances
by the scaled deltas, so frame-loop motion (canvas spins, WebGL scenes) slows
together with GSAP and WAAPI instead of ignoring the speed pills. The raw
`ticker.add()` loop is unscaled — Lenis smooth-scroll and other input
smoothing stay realtime — and production behavior is unchanged.
