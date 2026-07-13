# Modulato

A visual-design-first React framework for making websites, leveraging
custom transitions and animations. Built for humans and LLMs alike.

```sh
npm create modulato@latest my-site
```

- **Transitions are the center of gravity** — pages coexist during
  navigation: crossfade, slide, or FLIP shared elements between real layouts.
- **A persistent, URL-aware shell** — menu, cursor, canvas, WebGL live
  outside the page swap and react to navigation.
- **Motion numbers are data** — `motion.ts` tokens, tweakable live in the dev
  overlay (with AST-preserving save-back), responsive per breakpoint,
  reduced-motion aware, editable by agents over MCP.
- **SSR + hydration** — view-source is always complete; deploys to Vercel
  from a prebuilt Build Output.

Live demo: https://modulato-demo.vercel.app · Full reference:
[docs/MODULATO.md](./docs/MODULATO.md) (ships inside every scaffolded project).

## Packages

| Package | What |
|---|---|
| `modulato` | runtime (router, hooks, tokens) + the `modulato` CLI |
| `@modulato/vite` | the build: routing manifest, SSR, prod builds, Vercel output |
| `@modulato/server` | React SSR + server-action runner |
| `@modulato/gsap` | `useMotion` — page-scoped GSAP with auto-revert |
| `@modulato/tweak` | dev overlay + token writeback (Tweak Mode) |
| `@modulato/content-local` | local JSON content adapter |
| `@modulato/mcp` | MCP server for agents |
| `create-modulato` | scaffolder |

## Development

```sh
npm i
npm run dev     # examples/demo with SSR + HMR
npm run check   # TypeScript across demo + framework
```

See [PLAN.md](./PLAN.md) for the design document and build log.
