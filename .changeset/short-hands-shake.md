---
'modulato': patch
---

`modulato check`: warn when a fluid size is hand-written

A size written as `clamp(0.75rem, 1vw, 1.25rem)` is legal and passed through
untouched, which is exactly why it needed saying. The commonest way into a
Modulato project is porting one, and the thing being ported is a stylesheet
full of already-solved clamps — translating them across verbatim is the obvious
move and the wrong one. The string still renders, but it encodes a viewport
range its author never wrote down, and it reaches Tweak as one value the
overlay can name but not move, where `{ min, max }` is two numbers with a
slider each.

The ends are recoverable from a plain `clamp(A, …, B)`, so the warning says
what to write rather than only what is wrong:

```
type.ts  scale step `xs` is a hand-written fluid size. Write its two ends
         instead — `xs: { min: 12, max: 20 }` — and state the viewport range
         once in `fluid`.
```

Scale steps and a style's own `size` are both checked. MODULATO.md and the
scaffolded CLAUDE.md say the same thing about porting, where prose alone had
been permissive: "still works, still passed through untouched" reads as
permission when you are translating a legacy system.
