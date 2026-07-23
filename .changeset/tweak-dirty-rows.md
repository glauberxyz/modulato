---
'@modulato/tweak': minor
'modulato': minor
---

Tweak overlay: precision editing. Dirty rows are now visibly marked (● + accent
label) so what Save will write is always clear, each dirty row has its own ↺
reset to undo a stray slider drag without discarding the file's other edits,
and a filter box narrows long token lists by path — with dirty rows kept
visible even when they don't match, so a save's payload can never be
off-screen.

Core: `motionRegistry.resetLeaf(file, path)` — reset ONE leaf to the file's
last-known value (backs the overlay's per-row reset; additive, dev-only).
