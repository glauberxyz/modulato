# Contributing to Modulato

Written for humans and agents alike — Modulato is built LLM-first, and that
includes how it's built. If you're an agent: read this file plus
[docs/MODULATO.md](./docs/MODULATO.md) (the complete API) before changing
anything; [PLAN.md](./PLAN.md)'s STATUS section is the build log.

## Setup

```sh
npm i               # workspace install (Node >= 20; >= 24 for portless dev)
npm run dev         # examples/demo with SSR + HMR
npm run check       # TypeScript across demo + server + tweak + site — THE gate
```

## Repo map

- `framework/core` → npm `modulato` — runtime (router, hooks, tokens) + the CLI bin
- `framework/vite` → `@modulato/vite` — routing manifest, dev SSR, prod builds, Vercel output
- `framework/server` → `@modulato/server` — React SSR + server-action runner
- `framework/gsap` → `@modulato/gsap` — `useMotion`, Lenis↔ScrollTrigger sync
- `framework/tweak` → `@modulato/tweak` — dev overlay + AST token writeback
- `framework/content-local`, `framework/mcp`, `framework/create` — adapter, agents, scaffolder
- `examples/demo` — the proving ground. Every framework change must keep it green
  and, when user-facing, be demonstrated in it.
- `docs/MODULATO.md` — the single-file reference. Source of truth for all docs.

## Principles a PR must not break

1. **Published from source.** Packages ship raw TS; Vite is the compiler in
   every consumption path and TS consumers typecheck against `src`. Do not add
   tsup/rollup/dist steps — if a non-Vite surface ever appears, that's a
   design discussion, not a build script.
2. **LLM-first surfaces.** The CLI is non-interactive (args only, no prompts),
   takes `--json` everywhere, scaffolds atomically (a conflict creates
   NOTHING), and errors teach ("X is not a page. Known routes: …"). The MCP
   server and CLI share implementations (`modulato/cli`, `@modulato/tweak/tokens`).
3. **Motion numbers are data.** Tweakable values belong in `motion.ts` token
   modules, resolved via `resolveTokens()` — never hardcoded in animation code.
4. **Strict lifecycles.** Everything animated is created on mount and torn
   down on unmount. Pages stack during transitions; page roots paint opaque
   backgrounds.
5. **A feature isn't done** until: demo shows it, MODULATO.md documents it,
   `npm run check` passes, and it's verified running (browser for anything
   visual — SSR curl + DOM-state checks at minimum).

## Docs have three lives

`docs/MODULATO.md` is copied into two distribution channels:

```sh
npm run sync:docs   # → framework/create/MODULATO.md + docs/site/public/llms-full.txt
```

Run it after ANY docs edit. The copies still only reach users via a
`create-modulato` publish and a modulato.org redeploy — see the release ritual.

## Release ritual

1. Bump `version` in each changed package (and dependents' peer ranges, e.g.
   `@modulato/server` peers on `modulato`).
2. `npm run sync:docs` if docs changed; commit + push.
3. `(cd framework/<pkg> && npm publish --access public)` per changed package.
   Gotchas: scoped packages under this org have landed PRIVATE despite
   `--access public` — fix with `npm access set status=public @modulato/<pkg>`;
   stale npm tokens surface as 404 on PUT — `npm logout && npm login`.
4. If docs changed: rebuild + redeploy modulato.org
   (`cd docs/site && VERCEL=1 npx modulato build && vercel deploy --prebuilt --prod --scope glauber-house`)
   and publish `create-modulato` so scaffolds carry the fresh reference.
5. Verify from the registry (`npm view`, `npm pack` spot-checks), not just locally.

## Style

- Commit messages: imperative subject, body explains WHY (see `git log`).
- Comments state constraints the code can't, not narration.
- MIT. By contributing you agree your work is MIT-licensed.
