# Contributing to Modulato

Written for humans and agents alike — Modulato is built LLM-first, and that
includes how it's built. If you're an agent: read this file plus
[docs/MODULATO.md](./docs/MODULATO.md) (the complete API) before changing
anything.

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

Releases run on [Changesets](https://github.com/changesets/changesets) +
npm **Trusted Publishing (OIDC)** — there is no `NPM_TOKEN`, and versions are
never hand-edited. The CI is `.github/workflows/publish.yml`; all 8 packages'
trusted-publisher configs on npm point at that filename, so **do not rename
it**. Only public `framework/*` packages publish (`demo`, `modulato-org` are
`private` and skipped automatically).

**As you make a publishable change** — add a changeset in the same commit:

```sh
npm run changeset          # interview: which packages, patch/minor/major, summary
```

This writes `.changeset/<name>.md` (intent to release; nothing publishes yet).
Skip it for changes that don't ship to npm (docs site, demo, internal tooling).
Internal deps cascade automatically: a `modulato` bump carries its dependents
(`content-local`, `gsap`, `mcp`, `server`, `tweak`) via `updateInternalDependencies`.

> **Peer-dep bump behaviour — decide before your first core *minor*.**
> `content-local`, `gsap`, `tweak`, and `server` peer-depend on `modulato`
> (`^0.1.x`). `onlyUpdatePeerDependentsWhenOutOfRange` (in `.changeset/config.json`)
> keeps a core **patch** from touching them. But a core **minor** (`0.1.x →
> 0.2.0`) falls outside `^0.1.x`, so Changesets bumps those four peers — and,
> per peer semantics, bumps them **major → 1.0.0**. That's correct, just abrupt
> for a 0.x framework. If you'd rather core minors stay quiet, widen the plugins'
> peer ranges (e.g. `^0.1.0` → `>=0.1.0`) so minors stay in range. Leave as-is if
> a `1.0.0` on plugins alongside a core minor is fine by you.

**To cut the release (default — fully automated):**

1. Land your changesets on `main`. CI opens/refreshes a **"Version Packages"**
   PR that applies every pending bump + writes changelogs.
2. Merge that PR. CI then publishes each changed package to npm over OIDC,
   tags it, and creates a **GitHub Release** per package.
3. First real run: confirm the OIDC publish authenticated with no token (the
   one thing to eyeball, since npm must be ≥ 11.5.1 on the runner — the
   workflow upgrades it).

**Manual fallback** (local, uses your own `npm login` — OIDC only works in CI):

```sh
npm run changeset:version   # apply bumps + changelogs + refresh lockfile; commit
npm run changeset:publish   # npm publish per changed package + git tags
```

Gotchas: scoped packages under this org have landed PRIVATE despite
`access: public` — fix with `npm access set status=public @modulato/<pkg>`;
stale npm tokens surface as 404 on PUT — `npm logout && npm login`.

**Docs are not part of the npm release, and they now LEAD it.** Run
`npm run sync:docs` after any docs edit. Both sites deploy from `main`
automatically (see Vercel projects below), so a docs commit is live on
modulato.org within a minute — before the release that implements what it
describes. That window is real: `onPrepare` was on the site for some time
before `modulato@0.5.0` existed.

Write the reference in the present tense anyway — the alternative is holding
docs commits back, which is how they rot — but if a gap would actively
mislead, land the doc with the release rather than ahead of it.

Scaffolded projects are a separate path: they get the reference only via a
`create-modulato` publish (add a changeset for it), which does not auto-deploy.

Verify from the registry (`npm view`, `npm pack` spot-checks), not just locally.

## Vercel projects

Both sites deploy the same way, and both were once configured the same wrong
way — Root Directory at the repo root with Framework Preset "Vite", which no
automatic build could have succeeded with.

| | `modulato-org` | `modulato-demo` |
|---|---|---|
| serves | modulato.org | halftone.modulato.org |
| Root Directory | `docs/site` | `examples/demo` |

For both, in the Vercel dashboard (scope **glauber-house**):

- **Include source files outside of the Root Directory** ON — each is an npm
  workspace and `"modulato": "*"` only resolves from a root install
- **Framework Preset** Other. "Vite" makes Vercel look for `dist/` and apply
  its own routing, which loses the SSR function
- **Output Directory** blank — `@modulato/vite` emits `.vercel/output`
  (Build Output API v3) whenever `process.env.VERCEL` is set, which Vercel does
  during its own builds, and that output takes precedence

Each site's `vercel.json` pins framework and build command so those two are
reviewable in git rather than dashboard-only. Root Directory and the
include-outside toggle cannot be pinned — check the dashboard if a deploy
behaves oddly.

`modulato-demo` must stay in **glauber-house**: that scope owns `modulato.org`,
and a subdomain cannot attach from anywhere else.

Git integration is ON for both, so a push to `main` touching either site
rebuilds it. Before that the demo once served a build 37 days stale while
`main` moved on, and nothing said so — if you find yourself deploying by hand,
check the integration rather than making a habit of the manual path.

**Manual deploy**, the escape hatch when a build is broken:

```sh
cd examples/demo && VERCEL=1 npm run build      # or docs/site
vercel deploy --prebuilt --prod --scope glauber-house
```

It ignores the project settings entirely, which is why it kept working while
they were wrong. It needs `.vercel/project.json` present — that file is
gitignored, and without it the CLI names the project after the FOLDER and
silently creates a stray one. `vercel link` first if the directory is not
linked.

## Style

- Commit messages: imperative subject, body explains WHY (see `git log`).
- Comments state constraints the code can't, not narration.
- MIT. By contributing you agree your work is MIT-licensed.
