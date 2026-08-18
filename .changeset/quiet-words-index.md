---
'modulato': minor
'@modulato/vite': patch
'@modulato/tweak': patch
---

Motion groups can carry hidden search keywords.

A group is named for what it IS in the code and people search for what it DOES
on the page. "main description" is the chapter lede, governed by
`flight.enter.lede`, and no substring of that query reaches it — the vocabulary
is private to whoever named the group, and the problem widens as a site grows.

A motion file may now export `keywords` beside its default:

```ts
export const keywords: Record<string, string[]> = {
  'flight.enter.lede': ['main description', 'subtitle'],
}
```

The Tweak overlay indexes them and never renders them. A keyword hit shows the
group's rows unfiltered, the same as a file-path hit: the reader named a
purpose, not a value.

A separate EXPORT rather than a key inside `motion({...})`, and rather than the
magic comment first sketched for this. The token tree is numbers-and-eases —
`resolveTokens` hands it straight to animation code — so a `keywords` key would
become a row in the panel, widen the resolved type, and need special-casing at
every consumer. A comment would have needed a source parser in `@modulato/vite`
to reach the browser at all, and resolving a nested group's full path from raw
text is exactly the kind of thing that works until it doesn't; an export is
real JS that arrives for free.

`modulato check` warns when a keywords entry names no group in its file, which
is what a rename leaves behind. A warning, not an error — a stale keyword costs
discoverability, never correctness.

The other half of this is a convention, so it is written down where both people
and coding agents will meet it: MODULATO.md's motion-token section, and the
`CLAUDE.md` that `create-modulato` scaffolds into every new project. Authoring a
token group now means naming it AND saying what a reader would call it.
