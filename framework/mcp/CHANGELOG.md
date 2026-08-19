# @modulato/mcp

## 0.1.5

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

- Updated dependencies [c6d364d]
- Updated dependencies [c6d364d]
  - modulato@0.8.0
  - @modulato/tweak@0.4.1

## 0.1.4

### Patch Changes

- Updated dependencies [63bec8a]
- Updated dependencies [b56a79c]
- Updated dependencies [bec56e7]
- Updated dependencies [d0ff799]
  - modulato@0.6.0
  - @modulato/tweak@0.4.0

## 0.1.3

### Patch Changes

- Updated dependencies [94c05a8]
- Updated dependencies [31c3d17]
  - modulato@0.4.0
  - @modulato/tweak@0.3.0

## 0.1.2

### Patch Changes

- Updated dependencies [0c72f30]
- Updated dependencies [1359135]
- Updated dependencies [17d1397]
- Updated dependencies [731dffc]
- Updated dependencies [d0ac140]
  - modulato@0.3.0
  - @modulato/tweak@0.2.0

## 0.1.1

### Patch Changes

- 3a57bca: Widen the `modulato` dependency range to any 0.x (`>=0.1.0 <1.0.0`) so a core
  **minor** release no longer forces these packages to a major version bump. Core
  and the framework packages version together on the 0.x line; the range next needs
  revisiting when core reaches 1.0.
- Updated dependencies [9b927a0]
- Updated dependencies [acd438d]
- Updated dependencies [8a1bd2a]
- Updated dependencies [3a57bca]
  - modulato@0.2.0
  - @modulato/tweak@0.1.2
