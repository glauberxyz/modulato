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

CI runs that gate and five more on every pull request and push to `main`
(`.github/workflows/check.yml`): a strict `npm ci`, `npm run check`,
`modulato check` against the demo, a demo build, a scaffold-deps check and a
`sync:docs` no-op check. It mirrors the release environment (Node 24, npm 11)
on purpose.

**`publish.yml` runs that same gate itself, before it publishes** — and that,
not the PR check, is what makes a release safe. GitHub refuses to trigger
workflows on a pull request opened by its own `GITHUB_TOKEN`, so Check on the
"Version Packages" PR sits at `action_required` and is skipped unless somebody
approves it by hand — and that PR is the one whose merge ships to npm. Check's
`push: main` run races the release rather than blocking it, so it can go red
after the packages are already on the registry. Duplicating the gate inside
the release job costs two minutes and buys actual enforcement, with no
credential: a PAT would fix the trigger, but this repo publishes over OIDC
exactly so that no long-lived token exists.

The `npm ci` step is the load-bearing one. Release runs `npm ci` itself, so a
lockfile that cannot resolve used to fail *inside* the release: a peer range
naming a version that did not exist once failed five runs and froze an open
Version Packages PR. Verifying such a change locally needs `npm ci` too —
`npm install --package-lock-only` is lenient and passes anyway.

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
5. **Units are the framework's decision, not the author's.** A unit is a
   property of the token category and is emitted, never typed: a `size` in
   `type.ts` is the px a design was drawn at and ships in rem, tracking is em,
   leading and weight are unitless. Layout — in stylesheets — is px, so text
   can grow with a reader's font-size setting without the boxes around it
   inflating to match. A length that should follow the viewport is data too
   (`{ min, max }`), because a value with a unit baked in is a string, and a
   string is one Tweak can name but not move.
6. **A feature isn't done** until: demo shows it, MODULATO.md documents it,
   `npm run check` passes (CI runs it, plus `npm ci`, `modulato check`, a demo
   build and the docs-sync check), and it's verified running (browser for
   anything visual — SSR curl + DOM-state checks at minimum).

## The gate typechecks the scaffold TEMPLATE, not just the demo

`npm run check` ends with `tsc -p framework/create/templates/default`, and that
last project is the one nobody thinks of. The template is not a workspace — it
is copied to disk by `create-modulato` and only then installed — so for a long
time nothing typechecked it, and a scaffolded site could fail its own
`npm run check` on the first command a new user runs.

That is not hypothetical: `pages/styleguide/page.tsx` shipped in
create-modulato@0.2.0 indexing a literal object type with a `string`, which
`tsc` rejects. It was caught by scaffolding a project by hand and running `tsc`
in it — the gate had no opinion.

Two things follow. Keep the template's own `tsconfig.json` `include` list
current when you add a root file (`type.ts` and `color.ts` had to be added to
it), since a file outside that list is invisible to both this gate and the
user's. And when a change touches the template, scaffold one for real —
`node framework/create/index.mjs /tmp/x` — because `include` drift is exactly
the kind of thing an in-place typecheck cannot see.

## The scaffold's dependency ranges are generated

`framework/create/templates/default/package.json` pins the Modulato packages,
and those pins are **written by a script**, never by hand:

```sh
npm run sync:template            # rewrite from framework/*/package.json
node scripts/sync-template-deps.mjs --check   # what CI runs
```

Hand-maintained they went six minors stale in silence: the template said
`^0.1.0` while core was `0.7.0`, and on a `0.x` line caret never crosses a
minor — so `npm create modulato` handed every new user 0.1.7 and no `npm
update` could ever have fixed it. It hid well, because the scaffolded site
worked; it was just an old framework that disagreed with MODULATO.md.

`changeset:version` runs the script after the bump, so the Version Packages PR
carries the new ranges, and the Check gate fails on drift.

## The overlay's CSS is a checked-in build artifact

`framework/tweak/src/overlay.css` is compiled from `theme.css` by Tailwind and
committed. **Changing a class in any overlay component means rebuilding it:**

```sh
npm run build:css -w @modulato/tweak
```

Nothing errors if you forget. Tailwind only emits rules for classes it found in
the files `theme.css` lists as `@source`, so a class with no rule is simply
absent — the element renders unstyled and the app runs. That cost a whole
review cycle once: `type.tsx` was not a source, so its `pointer-events-auto`
never compiled, the Type Mode popup inherited `pointer-events: none` from its
layer, and every click fell THROUGH the card to the page underneath. The tabs
looked dead and the size control retargeted the card. The sources are globbed
now (`./*.tsx`), which fixes forgetting to LIST a file — but not forgetting to
rebuild.

Note also that a synthetic `element.click()` cannot catch this class of bug: it
dispatches straight at the node and skips hit-testing entirely. Verify overlay
interactions with real pointer events at real coordinates.

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

> **Peer-dep bump behaviour — settled, but know why.**
> `content-local`, `gsap`, `tweak`, and `server` peer-depend on `modulato`.
> `onlyUpdatePeerDependentsWhenOutOfRange` (in `.changeset/config.json`) keeps
> a core bump from touching them *while it stays in range* — but a bump that
> falls OUTSIDE the range makes Changesets bump those four, and per peer
> semantics it bumps them **major → 1.0.0**. With a `^0.1.x` peer range, every
> core minor would have done that.
>
> All four now declare `>=0.1.x <1.0.0`, so core minors stay in range and the
> plugins stay quiet. `npx changeset status` before merging is the check:
> if it reports a major on a plugin you did not intend to bump, a peer range
> is the reason. The ranges become live again at `modulato@1.0.0`, which is
> the right moment to revisit them.

**To cut the release (default — fully automated):**

1. Land your changesets on `main`. CI opens/refreshes a **"Version Packages"**
   PR that applies every pending bump + writes changelogs.
2. **Check that PR carries YOUR changesets before merging it**, then merge.
   CI publishes each changed package to npm over OIDC, tags it, and creates a
   **GitHub Release** per package.

   > A Version Packages PR that was already open is the trap. It was computed
   > from the changesets that existed when it was raised, and CI needs a moment
   > to refresh it after your merge — so merging it early applies a bump that
   > covers only the older changesets. Nothing publishes (the action versions
   > rather than publishes while any changeset is still pending), it opens a
   > NEW Version Packages PR, and the version you just bumped to exists in the
   > changelog and the git history but never on npm. Recoverable — merge the
   > new PR and it publishes — but npm skips a version. `0.11.0` is that scar.
   > `git log --oneline -1 origin/changeset-release/main` or a glance at the
   > PR's file list tells you whether your changesets are in it.
3. **Publishing succeeds before the registry agrees.** `npm view <pkg> version`
   read the OLD version for ~2½ minutes after a green publish. Read the
   workflow log ("🦋 Publishing …" / "New tag: …"), not `npm view`, to decide
   whether a publish happened — and never re-run a publish on the strength of
   `npm view` alone.
4. First real run: confirm the OIDC publish authenticated with no token (the
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
