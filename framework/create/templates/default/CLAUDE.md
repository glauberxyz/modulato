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

**Typography is data, in `type.ts` at the project root.** It holds the font
stacks, the size scale and the named styles; Modulato renders it into CSS
custom properties and one `.type-<name>` class per style, inlined into every
SSR response. Page stylesheets `@use 'styles/typography'` and
`@include type.style('body')`, or JSX uses `class="type-body"` — either way
they never declare font-family, font-size, line-height or letter-spacing
themselves. Page `styles.scss` files are layout only, and `modulato check`
warns when one declares type.

**Given a design to implement, or an instruction that changes how the site is
set — encode it in `type.ts` FIRST.** A new size becomes a scale step; a new
kind of text becomes a style. Never reach for a literal `font-size` in a page
stylesheet because the design has one more size than the scale does: add the
step. The scale is deliberately closed, and that is what keeps a site to a
type system instead of to forty-one accidental sizes.

Colors stay CSS variables in `styles/tokens.scss` (new color = add a variable
there FIRST, then use `var(--name)`).

`pages/styleguide/` is a specimen of both, read from the live values —
**delete the folder** (and its Menu entry) if the project does not want it.

In dev, the round **Aa** button beside the ✦ Tweak launcher turns the page into
the control: click any text to edit the style it is set in, saving either to the
style (everything wearing it moves) or to just that class. The panel's
Typography tab is the same tokens with the breakpoint tabs.

Dev server: `npm run dev` serves **https://<project-name>.localhost** (stable,
port-free, via portless — needs Node >= 24). In non-TTY/CI contexts or on
older Node, use `npm run dev:plain` (plain Vite on a port; honors PORT).
