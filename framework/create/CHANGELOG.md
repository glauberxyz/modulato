# create-modulato

## 0.1.9

### Patch Changes

- c6d364d: Fix two documented commands that could not work.

  - `claude mcp add modulato -- npx modulato-mcp` — there is no `modulato-mcp`
    package on npm (E404). `modulato-mcp` is the BIN provided by
    **`@modulato/mcp`**, so the command only resolved if that package already
    happened to be installed locally, and failed for exactly the person
    following the docs to set it up. It is now `npx -y @modulato/mcp`.
  - MODULATO.md's header told agents to scaffold a new site with `npx modulato
new`, which requires an existing site and rejects an empty directory. Site
    creation is `npm create modulato@latest <dir>`, which the reference never
    mentioned. Both are now stated, in the header and in the CLI section.

- c6d364d: Scaffold the current framework, not one six minors old.

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

## 0.1.8

### Patch Changes

- 32dcdf8: Refresh the bundled MODULATO.md reference: Tweak Mode section matches the
  redesigned overlay (view-scoped token list, breakpoint/reduced tabs, dirty
  dots, "✦ Tweak" launcher) and documents that dev slow-mo drives `useTicker`
  loops on the motion clock (raw `ticker.add()` stays realtime).
