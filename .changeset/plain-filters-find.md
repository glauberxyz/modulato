---
'@modulato/tweak': patch
---

The token filter matches file paths, not only token paths.

The file path is rendered directly above a card's rows and was the one thing in
the panel you could not search for. In a project with more than a handful of
motion files you could find `duration` — and get every file at once — but not
"everything for the screen chapter", and typing a folder name returned nothing
at all.

A file-path hit shows that file's rows UNFILTERED, which is the behaviour the
query asks for: the reader named a place, not a value, so narrowing the rows
would answer a question nobody asked and leave the card standing with most of
its contents missing. A token hit keeps narrowing as before, and the two
compose — in the demo, `figure` returns four `[figure]/motion.ts` cards whole
plus the shell's own file cut down to the six rows that mention one.

The dirty-row escape hatch is unchanged: a row with unsaved edits stays visible
under any query, because what Save will write must never be off-screen.
