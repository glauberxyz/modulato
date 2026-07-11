# A Modulato site

Scaffolded by [create-modulato](https://www.npmjs.com/package/create-modulato).

```sh
npm install
npm run dev        # SSR + HMR on https://<project-name>.localhost (portless)
npm run check      # conventions + TypeScript
npm run build      # production build (VERCEL=1 for .vercel/output)
```

`npm run dev` serves a stable, port-free URL named after the project via
[portless](https://www.npmjs.com/package/portless) (requires Node >= 24; the
first run asks to trust a local certificate). No Node 24, or a CI/non-TTY
environment? `npm run dev:plain` starts the plain Vite server on a port.

Open the ✦ motion button (dev) to tweak every animation number live —
Save writes back into the motion.ts files.

The full framework reference is in **MODULATO.md**. If you work with Claude
or another agent, it reads CLAUDE.md and MODULATO.md automatically.
