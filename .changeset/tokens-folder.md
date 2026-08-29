---
'modulato': minor
'@modulato/vite': minor
'@modulato/tweak': minor
'create-modulato': minor
'@modulato/mcp': patch
---

The site-wide token modules move into `tokens/`

`type.ts`, `color.ts` and the shell's `motion.ts` are one set — the three files
that say how a site is set, all data, all editable live in the overlay and
written back to disk — so they now live together in `tokens/` rather than as
three loose files at the project root. They stay out of `modulato.config.ts`
deliberately: that file runs in Node and may hold secrets, while these are read
by the browser.

**Nothing was removed.** A project scaffolded before this keeps its root
`type.ts`/`color.ts`/`motion.ts` and works untouched — the plugin, Tweak's Save
path and `modulato check` all accept both spellings. `modulato check` warns
until they are moved and prints the exact `git mv`, the import rewrites and the
`tsconfig.json` change.

The registry id a token file is held under is now read from where the file
actually is, rather than assumed, so Tweak Saves to the right path in either
layout.
