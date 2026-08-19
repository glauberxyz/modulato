---
'create-modulato': patch
'@modulato/mcp': patch
---

Fix two documented commands that could not work.

- `claude mcp add modulato -- npx modulato-mcp` — there is no `modulato-mcp`
  package on npm (E404). `modulato-mcp` is the BIN provided by
  **`@modulato/mcp`**, so the command only resolved if that package already
  happened to be installed locally, and failed for exactly the person
  following the docs to set it up. It is now `npx -y @modulato/mcp`.
- MODULATO.md's header told agents to scaffold a new site with `npx modulato
  new`, which requires an existing site and rejects an empty directory. Site
  creation is `npm create modulato@latest <dir>`, which the reference never
  mentioned. Both are now stated, in the header and in the CLI section.
