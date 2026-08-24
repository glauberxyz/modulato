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
- **Typography is data**, in `type.ts` at the project root: the two font
  stacks, the size scale, and every named style. Modulato renders it into CSS
  custom properties plus a `.type-<name>` class per style and inlines the
  result into every SSR response. `styles/typography.scss` is the SCSS
  spelling — mixins that read those variables and hold no numbers.
  A stylesheet **never declares `font-family` or `font-size`**: it includes a
  style, or reads `var(--type-size-<step>)` for one step off one.
  `npx modulato check` warns on the first and errors on a `--type-…` variable
  that names nothing. `/styles` is the specimen, read from the live values; the round **Tt**
  button beside the ✦ Tweak launcher edits any text where it sits.
- The persistent shell (menu, marker) lives in `app.tsx` outside
  `<PageOutlet/>`; it reacts to `useRoute()` / `useNavigation()`.

## Commands

- `npm run dev` — dev server with SSR + HMR (long-running)
- `npm run build` — production build; `npm run preview` serves it
- `npm run check` (repo root) — TypeScript across demo + framework

The complete framework reference: [../../docs/MODULATO.md](../../docs/MODULATO.md).
