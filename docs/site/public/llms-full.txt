# MODULATO.md — the complete reference

> Modulato is an animation-first React framework for marketing sites, landing
> pages and portfolios. This file is the entire API surface in one read —
> written for humans and language models alike. If you are an agent working on
> a Modulato project: scaffold with `npx modulato new`, edit files directly,
> and ALWAYS finish with `npx modulato check`.

Stack: React 19 · Vite 7 · GSAP (sole animation engine) · Lenis (smooth
scroll) · classic SSR + hydration (no RSC, no streaming).

## 1. Mental model

Three ideas carry everything:

1. **Transitions are the center of gravity.** During navigation the outgoing
   and incoming pages are BOTH mounted. You can crossfade them, slide them,
   or FLIP a shared element from one real layout to the other. When the
   choreography finishes, the old page unmounts — and unmounting guarantees
   cleanup (its smooth scroll, animations, observers all die with it).
2. **The shell is persistent and URL-aware.** Everything in `app.tsx` outside
   `<PageOutlet/>` (menu, cursor, canvas, WebGL scene) never unmounts. It
   reacts to navigation through hooks — a menu indicator that slides when the
   URL changes, a 3D object that repositions per route.
3. **Motion numbers are data.** Durations, eases, staggers, distances live in
   `motion.ts` token modules, not hardcoded in animation code. That makes
   them editable live in the dev overlay (✦ motion), responsive per
   breakpoint, reduced-motion aware, and writable by agents over MCP.

## 2. Project layout

```
my-site/
  app.tsx                      ← the shell: persistent components + <PageOutlet/>
  intro.ts                     ← OPTIONAL shell intro (first-load choreography)
  motion.ts                    ← OPTIONAL shell motion tokens
  modulato.config.ts           ← content adapter, breakpoints, site-wide <head>
  pages/
    home/                      ← route "/"        (the folder named `home` is the index)
      page.tsx                 ← REQUIRED — the page component (markup + behavior)
      config.ts                ← meta/SEO, data loader, scroll options
      styles.scss              ← auto-imported, scoped to the page's root class
      intro.ts                 ← first-load intro (navigations use transitions/)
      motion.ts                ← motion tokens for this page
      server.ts                ← server actions (never ships to the client)
    work/
      page.tsx                 ← route "/work"
      [slug]/page.tsx          ← route "/work/:slug"
  transitions/
    default.ts                 ← optional fallback (built-in crossfade otherwise)
    home__about.ts             ← home → about pair
    home__about.motion.ts      ← optional colocated tokens for that pair
    work__work-slug.ts         ← work → work/:slug (route ids: "/" is "-", brackets drop)
  behaviors/
    reveal.ts                  ← enhancers for HTML you don't control (CMS output)
  content/                     ← content source for @modulato/content-local
  .modulato/                   ← generated: content snapshot + types (commit it)
```

**A page is a folder in `pages/` containing `page.tsx`. There is NO
registration anywhere** — no route tables, no imports to add. Params use
brackets: `archive/[slug]` → `/archive/:slug`, available as `params.slug`.

## 3. Pages

```tsx
// pages/home/page.tsx — markup and behavior in ONE component
import { Img, Shared } from 'modulato'
import type { Project } from '../../content/types'

export default function Home({ featured }: { featured: Project[] }) {
  return (
    <main className="home">
      <h1 className="home__headline">Motion is the message.</h1>
      {featured.map((p) => (
        <a key={p.slug} href={`/work/${p.slug}`}>
          <Shared id={`cover:${p.slug}`}>
            <Img src={p.image} alt={p.title} ratio="3/2" />
          </Shared>
        </a>
      ))}
    </main>
  )
}
```

- Root element class matches the folder name by convention (`.home`) — that's
  what `styles.scss` scopes to.
- Links are plain `<a href>` — the router intercepts same-origin clicks.
  Opt out with `data-native`. Back/forward and scroll restoration just work.
- Props come from the loader in `config.ts`.

```ts
// pages/work/[slug]/config.ts
import type { LoadArgs } from 'modulato'

export function load({ params, content }: LoadArgs) {
  return { project: content.projects.find((p) => p.slug === params.slug) ?? null }
}

export function meta({ props }: LoadArgs & { props: ReturnType<typeof load> }) {
  return { title: props.project?.title ?? 'Not found', description: props.project?.description }
}

// Optional per-page smooth-scroll tuning (Lenis options), or `false` to disable.
// `restore: true` = scroll memory: link navigations BACK to this page land at
// the position it was left at (grid → detail → back-to-grid). Session-only;
// a fresh landing starts at the top. Back/Forward restore regardless.
export const scroll = { lerp: 0.08, restore: true }
```

`load` runs server-side for the first paint and client-side on navigations —
same code, same `content` snapshot. `meta` sets title/description (SSR +
client title sync).

## 4. The shell (app.tsx)

```tsx
import { PageOutlet } from 'modulato'
import { Menu } from './shell/Menu'

export default function App() {
  return (
    <>
      <Menu />          {/* persists forever, reacts to navigation */}
      <PageOutlet />    {/* pages mount/unmount here, coexisting mid-transition */}
    </>
  )
}
```

Shell components react through hooks:

```tsx
import { useNavigation, useRoute } from 'modulato'

const route = useRoute()          // committed route: { id, path, params }
const nav = useNavigation()       // { phase: 'idle'|'loading'|'transition', from, to }
const activeId = (nav.to ?? route).id   // switches the moment navigation starts
```

## 5. Hooks reference (all from 'modulato')

| Hook | Where | What |
|---|---|---|
| `useRoute()` | anywhere | committed route `{ id, path, params }` |
| `useNavigation()` | anywhere | `{ phase, from, to }` — `to` is set from navigation start |
| `usePage()` | inside a page | `{ route, phase: 'entering'\|'active'\|'leaving', element, lenis }` |
| `useScroll(cb)` | anywhere | smooth-scroll frames `{ scroll, limit, velocity, progress }`. Inside a page: that page's scroll. In the shell: the ACTIVE page's scroll, surviving navigations |
| `useTicker(cb)` | anywhere | per-frame `(time, delta)` on the single RAF ticker, auto-cleaned |
| `useViewport()` | anywhere | reactive `{ width, height, dpr, breakpoint, reducedMotion, isPhone, isTablet, isDesktop }` |
| `useFormAction(ref)` | inside a page | progressive server-action form wiring (§10) |
| `useMotion(fn)` | inside a page — from **@modulato/gsap** | page-scoped `gsap.context()`: selectors scoped to the page, everything auto-reverted on unmount, re-run on breakpoint change and Tweak replays |

Components: `<PageOutlet/>`, `<Shared id>` (mark FLIP elements — id must be
unique per page), `<Img src alt [ratio] [eager]/>` (lazy, async-decoded,
aspect-ratio reserved, fade-in, plain `<img>` without JS).

Non-hook: `ticker.add(cb)` / `ticker.remove(cb)` — same loop as `useTicker`,
for code outside React.

```tsx
// The idiomatic page animation — @modulato/gsap
import { useMotion } from '@modulato/gsap'
import { resolveTokens } from 'modulato'
import tokens from './motion'

useMotion(({ q, gsap }) => {
  const { cards } = resolveTokens(tokens).intro
  gsap.from(q('.home__card'), { y: cards.y, stagger: cards.stagger })
  return () => { /* optional extra teardown */ }
})
```

## 6. Intros (first load) and transitions (navigation)

**Intros** run once on first load, after `document.fonts.ready`; the page is
revealed in the same task the animation starts (no flash of unanimated
content, `<noscript>`-safe). Navigations never run intros — transitions own
those. A ROOT `intro.ts` (next to app.tsx) choreographs the persistent shell.

```ts
// pages/home/intro.ts
import gsap from 'gsap'
import { intro, resolveTokens } from 'modulato'
import tokens from './motion'

export default intro({
  async run({ element, route }) {
    const { headline } = resolveTokens(tokens).intro
    await gsap.from(element.querySelector('.home__headline'),
      { yPercent: headline.yPercent, duration: headline.duration, ease: headline.ease }).then()
  },
})
```

**Transitions** are one file per route pair: `transitions/<from>__<to>.ts`.
In filenames a route id is written with dashes — `/` becomes `-` and param
brackets drop — so `work/[slug]` is `work-slug` and work → work/:slug is
`work__work-slug.ts`. Names resolve against the routes that actually exist
(`modulato check` errors if two routes would shorten to the same name, and
still accepts the older `work__work.[slug].ts` dot form). The only dot in a
transition filename is a file kind: `.motion.ts` tokens, `.ts` code.
Resolution: exact pair → reversed pair if it sets `symmetric: true` →
`default.ts` → built-in crossfade.

```ts
// transitions/work__work-slug.ts
import { transition, flipShared } from 'modulato'

export default transition({
  symmetric: true,                     // also runs detail → list, mirrored
  async run({ from, to, trigger, shared }) {
    // BOTH pages are mounted. `from.element` is lifted into an overlay
    // (visually unmoved); `to.element` sits underneath at its final scroll.
    // `trigger` is the clicked link. `shared` are matched <Shared> pairs
    // with rects pre-measured — hand them to flipShared() to fly them.
    await Promise.all([
      ...shared.map((pair) => flipShared(pair, { duration: 700 })),
      from.element.animate([{ opacity: 1 }, { opacity: 0 }],
        { duration: 350, fill: 'forwards' }).finished,
      to.element.animate([{ opacity: 0 }, { opacity: 1 }],
        { duration: 500, fill: 'forwards' }).finished,
    ]).catch(() => {})
  },
})
```

Use GSAP or WAAPI inside — the contract is only "resolve when done". Start
animations synchronously in `run()` (before the first await) so the reveal
frame is animation frame zero. Colocate tokens as
`transitions/<pair>.motion.ts`.

## 7. Motion tokens & Tweak Mode

```ts
// pages/home/motion.ts — data, not code
import { motion } from 'modulato'

export default motion({
  intro: {
    headline: {
      yPercent: 120, duration: 1.1, stagger: 0.1, ease: 'expo.out',
      phone:   { yPercent: 60, duration: 0.85 },   // breakpoint override blocks
      reduced: { yPercent: 0, duration: 0 },        // prefers-reduced-motion, merges last
    },
  },
})
```

- Read tokens through **`resolveTokens(tokens)`** at animation-run time — it
  deep-merges the active breakpoint's block over the base (then `reduced`),
  so replays and breakpoint changes always see fresh values.
- **Tweak Mode** (dev, with `@modulato/tweak` installed): the ✦ motion
  overlay lists every token module — edit live, replay intro/shell/motions,
  loop, 0.1×–1× slow-mo, preview any breakpoint + reduced. **Save** writes
  values back into `motion.ts` with an AST-preserving edit (comments and
  formatting survive).
- Non-token animation code still works — it just doesn't appear in the
  overlay. Convention nudges toward tokens.
- Breakpoints are defined ONCE in `modulato.config.ts` (literal strings —
  they're statically extracted for the client):

```ts
// modulato.config.ts
import { defineConfig } from 'modulato/config'
import { localJson } from '@modulato/content-local'

export default defineConfig({
  content: localJson({ dir: 'content' }),
  breakpoints: {
    phone: '(max-width: 767px)',
    tablet: '(min-width: 768px) and (max-width: 1279px)',
  },
})
```

`desktop` is the implicit fallthrough. Breakpoint names become token override
keys and `useViewport().breakpoint` values.

## 8. Behaviors (enhancers)

For HTML you don't control — CMS rich text, markdown output. Files in
`behaviors/` are auto-discovered and applied to every matching node when a
page mounts; cleanup runs on unmount.

```ts
// behaviors/reveal.ts
import { enhance } from 'modulato'

export default enhance('[data-reveal]', ({ element, data, page }) => {
  const observer = new IntersectionObserver(/* … */)
  observer.observe(element)
  return () => observer.disconnect()
})
```

## 9. Content

```sh
npx modulato content     # pull source → .modulato/content.json + content.d.ts
```

The snapshot feeds every loader as `content`, fully typed (the generated
d.ts augments `ModulatoContent`; types DERIVE from content). Same data on
server and client. Commit `.modulato/` — builds stay reproducible without
content-source credentials. Adapters implement
`{ name, pull({ root }) => object }`; `@modulato/content-local` maps
`content/<name>.json` → `content.<name>`.

Derive types from the snapshot, never duplicate them:

```ts
import type { ModulatoContent } from 'modulato'
export type Project = ModulatoContent['projects'][number]
```

## 9b. Head tags & SEO (SSR'd)

Site-wide `<head>` tags — favicon, web manifest, theme-color, fonts, default
OG, analytics — go in `modulato.config.ts` `head` and are rendered on every
page. Per-page tags (og:title, og:image, canonical) come from `config.ts`
`meta()` and are appended after the site-wide ones. Everything is
server-rendered, so crawlers and link-preview bots see it on first load.

```ts
// modulato.config.ts
export default defineConfig({
  content: localJson(),
  head: {
    lang: 'en',                                    // <html lang> (default 'en')
    link: [
      { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
      { rel: 'manifest', href: '/site.webmanifest' },
      { rel: 'preconnect', href: 'https://use.typekit.net' },
    ],
    meta: [
      { name: 'theme-color', content: '#111' },
      { property: 'og:site_name', content: 'My Studio' },
      { property: 'og:type', content: 'website' },
    ],
    script: [
      { src: 'https://scripts.simpleanalyticscdn.com/latest.js', async: true },
    ],
  },
})
```

```ts
// pages/work/[slug]/config.ts — per-page OG for share previews
export function meta({ props }) {
  return {
    title: `${props.project.title} — My Studio`,
    description: props.project.summary,
    meta: [
      { property: 'og:title', content: props.project.title },
      { property: 'og:image', content: props.project.cover },
    ],
  }
}
```

`MetaResult` (returned by `meta()`) accepts `title`, `description`, `link[]`,
`meta[]`, `script[]`. Head tags are SSR-only; `document.title` still updates
on client navigation. Public files live in `public/` and are served from the
root (`public/favicon.svg` → `/favicon.svg`).

Per-page `script[]` is for crawler-facing payloads like JSON-LD:

```ts
// pages/work/[slug]/config.ts — structured data per project
export function meta({ props }) {
  return {
    title: props.project.title,
    script: [{
      type: 'application/ld+json',
      children: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'CreativeWork',
        name: props.project.title,
      }),
    }],
  }
}
```

### Analytics

Load any vendor site-wide via `head.script` — it's SSR'd into every page:

```ts
// modulato.config.ts
head: {
  script: [
    { src: 'https://scripts.simpleanalyticscdn.com/latest.js', async: true },
    // GA: { src: 'https://www.googletagmanager.com/gtag/js?id=G-XXX', async: true },
    // Mixpanel/GA init snippets: { children: '…init code…' },
  ],
},
```

**The SPA gotcha:** snippets only see the FIRST page load — Modulato swaps
pages client-side after that. Track navigations from the shell with
`useRoute()`:

```tsx
// shell/Analytics.tsx — rendered in app.tsx, vendor-agnostic
import { useEffect, useRef } from 'react'
import { useRoute } from 'modulato'

export function Analytics() {
  const { path } = useRoute()          // commits when a transition completes
  const first = useRef(true)
  useEffect(() => {
    if (first.current) return void (first.current = false) // initial load: snippet handles it
    // mixpanel?.track_pageview()
    // gtag?.('event', 'page_view', { page_path: path })
    // window.sa_pageview?.(path)
  }, [path])
  return null
}
```

Vendor notes: SimpleAnalytics and GA4 (enhanced measurement) auto-detect
History API navigations — script alone is usually enough. Mixpanel needs
`track_pageview: 'url-with-path'` in its init, or the manual call above.
Never put analytics in per-page `script[]` — head scripts don't re-run on
client navigation.

## 10. Server actions

```ts
// pages/contact/server.ts — SERVER-ONLY. This module never reaches the
// client bundle (the build replaces it with URL stubs). Secrets are safe.
import { action } from 'modulato'

export const subscribe = action(async ({ form }) => {
  const email = String(form.get('email') ?? '')
  if (!email.includes('@')) throw new Error('Invalid email')   // → error state
  await esp.subscribe(email)
  return { message: 'Subscribed!' }                            // → data (typed)
  // or: return { redirect: '/thanks' }                        // no-JS redirect
})
```

```tsx
// pages/contact/page.tsx
import { useFormAction } from 'modulato'
import { subscribe } from './server'

function Form() {
  const { attrs, state, data, error } = useFormAction(subscribe)
  return (
    <form {...attrs} data-state={state}>
      <input name="email" type="email" required />
      <button disabled={state === 'pending'}>Subscribe</button>
      {state === 'ok' && <p>{data?.message}</p>}
      {state === 'error' && <p>{error}</p>}
    </form>
  )
}
```

The form renders a real `action=` URL — without JS it still submits (303
redirect, PRG). With JS, `useFormAction` intercepts, posts via fetch, and
drives `idle → pending → ok | error`. `data` is typed from the handler's
return type. Convention: actions are `export const <name> = action(...)`.

## 11. Feeding custom components (canvas, WebGL, r3f)

Modulato ships no 3D features on purpose. Instead, ANY persistent component
gets the site's state through the same hooks:

```tsx
// shell/Scene.tsx — the recipe (works identically for react-three-fiber)
import { resolveTokens, useNavigation, useScroll, useTicker, useViewport } from 'modulato'
import tokens from '../motion'

export function Scene() {
  const nav = useNavigation()               // spin faster while transitioning
  useScroll((e) => { /* rotate with the active page's scroll (survives navs) */ })
  useTicker((time, delta) => { /* one frame loop, auto-cleaned */ })
  const { breakpoint, reducedMotion } = useViewport()
  const { scene } = resolveTokens(tokens)   // tweakable numbers
  // …drive your canvas / three.js scene from these…
}
```

For r3f specifically: put `<Canvas>` in the shell, read `useNavigation`/
`useRoute` OUTSIDE the canvas and pass values in as props or a store —
`useScroll`/`useTicker` work anywhere (they don't depend on React context
when used in the shell).

## 12. CLI

Every command is non-interactive (args only), safe to retry, and takes
`--json` for machine-readable output. Exit codes: 0 ok, 1 error.

```
modulato dev                          dev server, SSR + HMR (runs until killed;
                                        honors PORT — scaffolded sites run it
                                        through portless: a stable, port-free
                                        https://<name>.localhost URL. Node >= 24;
                                        fallback: npm run dev:plain)
modulato build                        production build (client + ssr passes)
modulato new page <route>             scaffold pages/<route>/ (atomic: conflicts create NOTHING)
modulato new transition <from> <to>   [--symmetric]
modulato new behavior <name>
modulato new intro [route]            omit <route> for the shell intro
modulato content                      pull content → typed snapshot
modulato routes [--json]              route table derived from pages/
modulato tokens [filter] [--json]     motion tokens from every motion.ts
modulato check [--json]               validate contracts — run after every edit
```

`modulato check` catches: orphaned page companions, missing default exports,
malformed/dangling transition pairs, a shell without `<PageOutlet/>`,
misplaced intro.ts.

## 13. MCP (agents)

```sh
claude mcp add modulato -- npx modulato-mcp     # run from the site root
```

Tools: `list_routes`, `check`, `scaffold_page/transition/behavior/intro`,
`list_motion_tokens`, `set_motion_tokens` (AST-preserving file write —
applied LIVE to the running dev server via HMR), `replay`
(intro/shell/motions), `set_speed`. Token writes land in `motion.ts`, so a
human in the overlay and an agent over MCP always converge on the same file.

Dev-page introspection: `window.__MODULATO__` exposes route, tokens, speed,
replay functions, viewport forcing, and `tick()`.

## 14. Build & deploy

```sh
modulato build                 # dist/client (hashed assets) + dist/server (bundled SSR)
VERCEL=1 modulato build        # also emits .vercel/output (Build Output API v3)
vercel deploy --prebuilt       # deploy exactly what was built locally
```

On Vercel's own builders `VERCEL=1` is set automatically. The SSR bundle is
dependency-free (single function). Assets ship with immutable cache headers.
SSR HTML is always complete — view-source shows the whole page.

## 15. Contracts & gotchas

- Page root class = folder name (`pages/work/` → `.work`) — the styles.scss
  scope convention.
- **Pages STACK during transitions** — the incoming page renders underneath
  the outgoing one from frame zero. Give every page root an opaque
  `background`, or the incoming page shows through the outgoing page's
  transparent areas the moment navigation starts. To reproduce a classic
  "swap" choreography, hide the outgoing page mid-timeline
  (`timeline.set(from.element, { autoAlpha: 0 }, swapAt)`) and start the
  enter animations at that same position.
- `<Shared>` ids must be unique per page; unmatched ids simply don't FLIP.
  Shared-element FLIP animates the element's BOX (position/size), not its
  content — give the from/to elements the same `object-fit` (and similar
  aspect) so the image doesn't pop when the clone lands.
- To start a FLIP flight mid-choreography use `flipShared(pair, { delay })` —
  it hides both originals SYNCHRONOUSLY and flies later. Never wrap
  flipShared in a setTimeout: the incoming cover stays visible until it runs.
- ScrollTrigger auto-syncs with the page's Lenis when you use `useMotion`
  (from `@modulato/gsap`) and have registered `ScrollTrigger` — no per-project
  `lenis.on('scroll', …)` glue needed.
- `motion.ts` values must be serializable data (numbers/strings/booleans);
  breakpoint blocks are per-group, merged over the base, `reduced` last.
- `modulato.config.ts` runs in Node (content adapters can use fs/secrets);
  its `breakpoints` must be literal strings (statically extracted).
- server.ts exports must be `export const <name> = action(...)`.
- Nested scrollable UI under Lenis needs `data-lenis-prevent` on the
  scrollable element.
- Transitions should start their animations synchronously in `run()`.
- After ANY structural edit: `npx modulato check`.
