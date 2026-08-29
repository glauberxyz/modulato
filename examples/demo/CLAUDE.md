# Modulato site — agent guide

This is a Modulato project (animation-first React framework). The CLI is
non-interactive and JSON-friendly — prefer it over doing things by hand:

- **Create things with the CLI**, then edit the generated files directly:
  - `npx modulato new page <route>` (params in brackets: `archive/[slug]`)
  - `npx modulato new transition <from> <to> [--symmetric]`
  - `npx modulato new behavior <name>` · `npx modulato new intro [route]`
- **Always finish with `npx modulato check`** — it validates the project's
  contracts (like a type-checker for conventions) and exits 1 on errors.
- **Introspect instead of grepping**: `npx modulato routes --json`,
  `npx modulato tokens --json`, `npx modulato check --json`.

## Conventions

- A page is a folder in `pages/` containing `page.tsx` — routes derive from
  folder paths, there is NO registration anywhere.
- Page folder companions (all optional): `config.ts` (meta/load/scroll),
  `styles.scss` (auto-imported, scoped to the page's root class),
  `intro.ts` (first-load animation), `motion.ts` (tweakable motion tokens).
- Transitions live in `transitions/<from>__<to>.ts` — a route id is written
  with dashes: `/` becomes `-`, param brackets drop (`work__work-slug.ts`).
- Animation numbers belong in `motion.ts` token modules (`motion({...})`),
  not hardcoded in animation code — that's what makes them tweakable live
  (dev overlay ✦ motion) and editable via `set_motion_tokens` (MCP).
- A token group gets **search keywords**, exported as `keywords` beside the
  default — three to six plain phrases for what the reader would see change
  ("main description", "horizontal scroll"). A group is named for what it IS
  in the code; people search the overlay for what it DOES. Keep them honest
  when a group is renamed: `npx modulato check` warns on an entry that names
  no group. See the map at the foot of `motion.ts`.
- A **custom easing curve** is declared ONCE in `modulato.config.ts` under
  `eases` (a `cubic-bezier()` string), then used in tokens by name in GSAP
  files (`ease: 'swoosh'`) and as the cubic-bezier in transition files (WAAPI
  only speaks CSS). Never register a CustomEase by hand.
- **Typography is data**, in `tokens/type.ts`: the two font
  stacks, the size scale, and every named style. Modulato renders it into CSS
  custom properties plus a `.type-<name>` class per style and inlines the
  result into every SSR response. `styles/typography.scss` is the SCSS
  spelling — mixins that read those variables and hold no numbers.
  A stylesheet **never declares `font-family` or `font-size`**: it includes a
  style, or reads `var(--type-size-<step>)` for one step off one.
  `npx modulato check` warns on the first and errors on a `--type-…` variable
  that names nothing. `/styles` is the specimen, read from the live values; the round **Aa**
  button beside the ✦ Tweak launcher edits any text where it sits.
- **The palette is data**, in `tokens/color.ts` — each key is a
  `--variable`, inlined into every SSR response. `styles/tokens.scss` keeps
  only the grid and the `.is-dark` surface switch, which points back at the
  palette's own `dark-*` entries rather than duplicating them.
- The persistent shell (menu, marker) lives in `app.tsx` outside
  `<PageOutlet/>`; it reacts to `useRoute()` / `useNavigation()`.

## Commands

- `npm run dev` — dev server with SSR + HMR at a stable
  **modulato-demo.localhost** (portless; Node >= 24). The name lives in
  `portless.json`; the URL never changes, so nothing here juggles port numbers.
- `npm run dev:plain` — plain Vite on a port. The fallback when the proxy
  cannot run at all.

  The proxy is ONE daemon per machine, not a per-project setting — `portless
  run` starts it on demand, and `portless.json` only names the app. Whether it
  serves https and on which port is decided there and applies to every project:
  `:443` needs sudo and gives clean URLs, and without sudo portless falls back
  to `:1355` on its own, so **no setup is required for a new contributor**.
  `portless service install` starts it at login. If it ever fails with EACCES,
  check `~/.portless` for files left root-owned by an earlier `sudo portless`
  run — that, not TLS, is the usual cause.
- `npm run build` — production build; `npm run preview` serves it
- `npm run check` (repo root) — TypeScript across demo + framework

The complete framework reference: [../../docs/MODULATO.md](../../docs/MODULATO.md).
