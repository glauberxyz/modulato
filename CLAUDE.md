# Modulato monorepo — agent guide

This is the Modulato framework itself (animation-first React, LLM-first DX).

- **Before contributing**: read [CONTRIBUTING.md](./CONTRIBUTING.md) — repo
  map, non-negotiable principles (source publishing, non-interactive CLI,
  tokens-are-data), the check gate, and the release ritual.
- **API reference**: [docs/MODULATO.md](./docs/MODULATO.md) — the entire
  framework in one read. After editing it, run `npm run sync:docs`.
- **Build log / decisions**: [PLAN.md](./PLAN.md) (see the STATUS block in §11).
- **Commands**: `npm run dev` (demo), `npm run check` (the gate),
  `npm run dev:site` (modulato.org), `npm run sync:docs`.
- The demo (`examples/demo`) is the proving ground — framework changes must
  keep it green and be demonstrated there when user-facing.
