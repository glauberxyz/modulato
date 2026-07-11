# Modulato site — agent guide

This is a Modulato project (animation-first React framework). **Read
MODULATO.md in this directory** — it's the complete API reference in one
file. The CLI is non-interactive and JSON-friendly; prefer it:

- Create things with the CLI, then edit the generated files directly:
  `npx modulato new page <route>` · `new transition <from> <to>` ·
  `new behavior <name>` · `new intro [route]`
- **Always finish with `npx modulato check`** (exit 1 on contract errors).
- Introspect instead of grepping: `npx modulato routes --json`,
  `npx modulato tokens --json`.
- Content changed? `npx modulato content` (regenerates snapshot + types).
- Agents can drive motion live: `claude mcp add modulato -- npx modulato-mcp`

Key conventions: a page is a folder in `pages/` with `page.tsx` (no
registration); animation numbers live in `motion.ts` token modules;
transitions are `transitions/<from>__<to>.ts`; the persistent shell lives in
`app.tsx` outside `<PageOutlet/>`.

Dev server: `npm run dev` serves **https://<project-name>.localhost** (stable,
port-free, via portless — needs Node >= 24). In non-TTY/CI contexts or on
older Node, use `npm run dev:plain` (plain Vite on a port; honors PORT).
