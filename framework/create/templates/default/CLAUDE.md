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
- Agents can drive motion live: `claude mcp add modulato -- npx -y @modulato/mcp`

Key conventions: a page is a folder in `pages/` with `page.tsx` (no
registration); animation numbers live in `motion.ts` token modules;
transitions are `transitions/<from>__<to>.ts`; the persistent shell lives in
`app.tsx` outside `<PageOutlet/>`.

When you author a token group, give it search terms. A group is named for what
it IS in the code and people search the Tweak overlay for what it DOES on the
page, so export a `keywords` map beside the default — three to six plain
phrases per group, describing what the reader would see change:

```ts
export default motion({ /* … */ })

export const keywords: Record<string, string[]> = {
  'hero.title': ['headline', 'big type', 'first thing you see'],
}
```

The overlay indexes them and never shows them. Update them when you rename or
repurpose a group; `modulato check` warns when an entry names no group.

Custom easing curves are declared ONCE in `modulato.config.ts` under `eases`
(`swoosh: 'cubic-bezier(0.62, 0.05, 0.01, 0.99)'`) — never register a GSAP
CustomEase by hand. Use them in tokens by name in GSAP files (`ease:
'swoosh'`) and as the cubic-bezier in transition files (WAAPI only speaks
CSS); the Tweak overlay writes the right spelling for you.

Design tokens mirror motion tokens: colors/fonts are CSS variables in
`styles/tokens.scss` (new color = add a variable there FIRST), and every
text style is a mixin in `styles/typography.scss` (pages `@use` and
`@include` — never declare font properties in a page stylesheet). Page
`styles.scss` files are layout only.

Dev server: `npm run dev` serves **https://<project-name>.localhost** (stable,
port-free, via portless — needs Node >= 24). In non-TTY/CI contexts or on
older Node, use `npm run dev:plain` (plain Vite on a port; honors PORT).
