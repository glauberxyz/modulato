---
'modulato': minor
'@modulato/tweak': minor
'create-modulato': minor
'@modulato/mcp': patch
---

Units are the framework's decision, not the author's: type ships in rem, and a fluid size is two numbers

`type.ts` never contained a unit and still doesn't — but a bare `size` number
now emits **rem** rather than px (`18` → `1.125rem`). The author keeps writing
the px the design was drawn at, which is what a designer and a generated
stylesheet both reason in; the division by the root size is the framework's
job. The effect is that a reader who has raised their browser's font-size
setting gets larger text. That setting and page zoom are different
affordances — zoom scales the whole page, the font-size setting scales only
text — and rem is the only unit that hears the second one.

Layout is the other half of the rule and stays **px**. The scaffold's page
stylesheets were written in rem, which is the one combination with no coherent
story: a reader who asked for bigger text got a layout that inflated around
type that did not move. They are now px throughout, and `styles/tokens.scss`
states the convention where a stylesheet author will meet it.

`modulato check` **warns** when a page stylesheet sizes layout in rem, next to
the warning it already emits for declaring `font-size` there — the two halves
of one rule, and the half a generated stylesheet is most likely to get wrong.
It is a warning, not an error, so it does not fail the gate. Media and
container queries are exempt (a breakpoint in rem is a real position), as are
`em` and `ch`, which say the length tracks the type it holds.

A size that grows with the viewport is now data rather than a `clamp()` string:

```ts
fluid: { from: 390, to: 1440 },              // the range, once, for the scale
scale: {
  display:   { min: 44, max: 90 },           // 44px at 390, 90px at 1440
  statement: { min: 40, max: 190, from: 320, to: 1600 },   // its own range
}
```

Modulato solves the line through the two points and emits
`clamp(2.75rem, 1.6821rem + 4.381vw, 5.625rem)`. Two reasons it belongs in the
token file. It is the accessible spelling — keeping the middle term's intercept
in rem is what lets a fluid size answer both the font-size setting and zoom,
where a `clamp(44px, 9vw, 90px)` answers neither, since zoom does not change
the viewport width in CSS pixels. And it stays editable: Tweak puts a slider on
every number in the token tree, so a `{ min, max }` step gets two of them, live
on the page, where a `clamp()` string is a value the overlay can name but not
move — and the fluid steps are usually the headlines, i.e. the sizes most worth
nudging.

Hand-written `clamp()` values still pass through untouched. They just encode a
viewport range nobody wrote down, which is what `fluid` exists to state.

**Upgrading.** Nothing to change: existing `type.ts` files keep working, and at
the default root size every page renders identically. Sites that size layout in
rem should sweep it to px to get the benefit — otherwise the layout scales with
the text and the two cancel out.
