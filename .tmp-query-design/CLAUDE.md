# Modulato monorepo — agent guide

This is the Modulato framework itself (animation-first React, LLM-first DX).

- **Before contributing**: read [CONTRIBUTING.md](./CONTRIBUTING.md) — repo
  map, non-negotiable principles (source publishing, non-interactive CLI,
  tokens-are-data), the check gate, and the release ritual.
- **API reference**: [docs/MODULATO.md](./docs/MODULATO.md) — the entire
  framework in one read. After editing it, run `npm run sync:docs`.
- **Commands**: `npm run dev` (demo), `npm run check` (the gate),
  `npm run dev:site` (modulato.org), `npm run sync:docs`.
- **Releasing** (when Glauber says "publish"/"release" a new version): the repo
  uses **Changesets + npm Trusted Publishing (OIDC)** — never hand-edit
  `version` fields. Add a changeset for the change (`npm run changeset`), land it
  on `main`, then merge the auto "Version Packages" PR — CI bumps, publishes over
  OIDC, tags, and cuts a GitHub Release. Full steps + the manual fallback + the
  docs/modulato.org redeploy: the **Release ritual** in
  [CONTRIBUTING.md](./CONTRIBUTING.md). The publish workflow filename
  (`.github/workflows/publish.yml`) is pinned by npm's trusted-publisher configs
  — don't rename it.
- The demo (`examples/demo`) is the proving ground — framework changes must
  keep it green and be demonstrated there when user-facing.
