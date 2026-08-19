---
'create-modulato': patch
---

Scaffold the current framework, not one six minors old.

The template pinned `^0.1.0` for every Modulato package. On a `0.x` line caret
never crosses a minor, so the range could never reach `0.7.0` — `npm create
modulato@latest` installed `modulato@0.1.7`, and no `npm update` could have
fixed it. It hid well: the scaffolded site worked, it was just an old
framework that disagreed with the MODULATO.md shipped beside it.

The ranges are now GENERATED from the versions being released
(`scripts/sync-template-deps.mjs`, run by `changeset:version` and enforced by
CI) rather than hand-maintained.

Also: the template declares `engines.node >= 24` and ships an `.nvmrc`. Its
default `dev` script runs through portless, which requires Node 24 — without
its own `engines` the install warning named portless instead of the site,
reading like a broken dependency rather than "this template wants Node 24".
