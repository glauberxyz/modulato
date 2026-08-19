---
'@modulato/vite': patch
'@modulato/tweak': patch
---

`data-modulato-source` drops the column, ending a hydration warning on every page.

Vite's client and SSR transforms disagree about where a parenthesised JSX
expression starts — an arrow body, a ternary branch — for roughly one host
element in five, by a delta that varies, so it could not be corrected
arithmetically. The attribute was the only thing that differed between the two
renders, so each of those elements logged a React hydration mismatch. The
noise trains people to ignore hydration warnings, which is exactly when a real
one appears.

Lines agreed on every element measured, and the column bought nothing:
`/__modulato/open` hands the value to Vite's `/__open-in-editor`, which is
happy with `file:line`, and an editor puts the cursor on the right line either
way. The attribute is now `/pages/home/page.tsx:78`.
