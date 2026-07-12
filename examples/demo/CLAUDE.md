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
- The persistent shell (menu, marker) lives in `app.tsx` outside
  `<PageOutlet/>`; it reacts to `useRoute()` / `useNavigation()`.

## Commands

- `npm run dev` — dev server with SSR + HMR (long-running)
- `npm run build` — production build; `npm run preview` serves it
- `npm run check` (repo root) — TypeScript across demo + framework

The complete framework reference: [../../docs/MODULATO.md](../../docs/MODULATO.md).
