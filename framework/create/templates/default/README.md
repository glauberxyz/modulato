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
first run asks to trust a local certificate). The domain name lives in
`portless.json` — edit it to change your `<name>.localhost`. No Node 24, or a CI/non-TTY
environment? `npm run dev:plain` starts the plain Vite server on a port.

Open the ✦ Tweak button (dev) to tweak every animation number live — Save
writes back into the motion.ts files. The same panel edits the type system in
`type.ts`; flip on **Click text** and click any heading on the page to change
the style it is set in, where it sits.

`/styleguide` is a specimen of the type styles, the size scale and the colors,
read from the live values. Delete `pages/styleguide/` (and its entry in
`shell/Menu.tsx`) if you don't want it.

The full framework reference is in **MODULATO.md**. If you work with Claude
or another agent, it reads CLAUDE.md and MODULATO.md automatically.
