---
'modulato': minor
'@modulato/vite': minor
'@modulato/tweak': minor
'create-modulato': patch
---

A string token can declare its choices, and Tweak shows a select

A string token in a `motion.ts` was free text in the overlay unless it was an
ease. For a closed set — a theme name, a variant — that is the wrong control: a
typo is not an error, it is a silent fallback to whatever the code does with a
name it does not know.

A token file can now export `options` beside its default, the same way it
exports `keywords`: a map from a dotted token path to the values it may take.

```ts
export default motion({ flowers: { theme: 'bloom' } })

export const options: Record<string, string[]> = {
  'flowers.theme': ['bloom', 'candy', 'mono'],
}
```

The overlay renders that token as a select — the control an ease gets. A value
already in the file that is not in the list still shows, marked unknown. An
override block's copy (`reduced: { theme }`) gets the same list. `modulato check`
warns when an entry names no token.

All three packages are needed for it: `@modulato/vite` hands the export to the
registry, `modulato` keeps it, `@modulato/tweak` reads it. Each tolerates an
older neighbour — the token is simply a text box, as before.
