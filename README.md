<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./docs/brand/banner-dark.png">
  <img src="./docs/brand/banner-light.png" alt="Modulato" width="100%">
</picture>

[![npm](https://img.shields.io/npm/v/modulato?style=flat-square&color=0a0a0a&labelColor=555)](https://www.npmjs.com/package/modulato)
[![downloads](https://img.shields.io/npm/dm/modulato?style=flat-square&color=0a0a0a&labelColor=555)](https://www.npmjs.com/package/modulato)
[![build](https://img.shields.io/github/actions/workflow/status/glauberxyz/modulato/publish.yml?branch=main&style=flat-square&color=0a0a0a&labelColor=555)](https://github.com/glauberxyz/modulato/actions/workflows/publish.yml)
[![license](https://img.shields.io/npm/l/modulato?style=flat-square&color=0a0a0a&labelColor=555)](./LICENSE)

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

## Demo
- [Example](https://modulato-demo.vercel.app)
- [Glauber.org](https://glauber.org)

Full reference: [docs/MODULATO.md](./docs/MODULATO.md) (ships inside every scaffolded project).

## Packages

| Package | Version | What |
|---|---|---|
| `modulato` | [![npm](https://img.shields.io/npm/v/modulato?style=flat-square&color=0a0a0a&labelColor=555&label=)](https://www.npmjs.com/package/modulato) | runtime (router, hooks, tokens) + the `modulato` CLI |
| `@modulato/vite` | [![npm](https://img.shields.io/npm/v/@modulato/vite?style=flat-square&color=0a0a0a&labelColor=555&label=)](https://www.npmjs.com/package/@modulato/vite) | the build: routing manifest, SSR, prod builds, Vercel output |
| `@modulato/server` | [![npm](https://img.shields.io/npm/v/@modulato/server?style=flat-square&color=0a0a0a&labelColor=555&label=)](https://www.npmjs.com/package/@modulato/server) | React SSR + server-action runner |
| `@modulato/gsap` | [![npm](https://img.shields.io/npm/v/@modulato/gsap?style=flat-square&color=0a0a0a&labelColor=555&label=)](https://www.npmjs.com/package/@modulato/gsap) | `useMotion` — page-scoped GSAP with auto-revert |
| `@modulato/tweak` | [![npm](https://img.shields.io/npm/v/@modulato/tweak?style=flat-square&color=0a0a0a&labelColor=555&label=)](https://www.npmjs.com/package/@modulato/tweak) | dev overlay + token writeback (Tweak Mode) |
| `@modulato/content-local` | [![npm](https://img.shields.io/npm/v/@modulato/content-local?style=flat-square&color=0a0a0a&labelColor=555&label=)](https://www.npmjs.com/package/@modulato/content-local) | local JSON content adapter |
| `@modulato/mcp` | [![npm](https://img.shields.io/npm/v/@modulato/mcp?style=flat-square&color=0a0a0a&labelColor=555&label=)](https://www.npmjs.com/package/@modulato/mcp) | MCP server for agents |
| `create-modulato` | [![npm](https://img.shields.io/npm/v/create-modulato?style=flat-square&color=0a0a0a&labelColor=555&label=)](https://www.npmjs.com/package/create-modulato) | scaffolder |

## Development

```sh
npm i
npm run dev     # examples/demo with SSR + HMR
npm run check   # TypeScript across demo + framework
```

---

Maintained by [Glauber](https://x.com/glauberxyz) & Claude
