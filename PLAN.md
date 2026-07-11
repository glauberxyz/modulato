# Modulato — Framework Plan

> An animation-first **React** framework, designed to be the fastest framework for LLMs to
> build visually impactful marketing sites, landing pages, and portfolios. Successor to
> Lisergia.

**npm status (checked 2026-07-10):** `modulato`, `modulato-js`, and the `@modulato/*` scope
are all unclaimed. Plan: publish core as **`modulato`** (which also owns the `modulato` CLI
bin), everything else under **`@modulato/*`** (claim the npm org when publishing).

---

## 1. What we learned from Lisergia (and glauber-2026)

### The ideas worth keeping

These are Lisergia's genuinely good ideas — the reason Next.js/TanStack can't replicate the
results — and they are the soul of Modulato:

1. **Transitions are the framework's center of gravity**, not an afterthought. The old page
   and the new page coexist during navigation, so you can crossfade, slide, or FLIP a
   shared element (glauber-2026's Home→Archive thumbnail clone) between real layouts.
2. **A persistent shell that reacts to the URL.** Menu, nav, cursor, canvas live outside
   the swapped page area, survive navigation, and receive explicit navigation events — the
   "persistent element that changes state based on the URL."
3. **Strict mount/destroy lifecycles.** Every animated thing is created on page mount and
   torn down on unmount (Lenis, ScrollTriggers, observers, RAF subscriptions). No leaks.
4. **Server-rendered HTML for SEO** — view-source is always complete.
5. **Per-page scroll/RAF ownership** — each page gets its own Lenis instance and RAF slot,
   coordinated by one ticker.

### The pain points to fix

Confirmed by deep exploration of both repos:

| Pain | Evidence |
|---|---|
| **Adding one page touches ~7 files** | glauber-2026: `views/pages/Foo.tsx`, `src/app/pages/Foo.ts`, route entry in `src/app/index.ts`, Express route in `router/index.tsx`, template derivation + conditional in `views/Layout.tsx`, `src/styles/pages/foo.scss` + its `@import`, plus Transition branches |
| **Server view and client class are separate files glued by selector strings** | `.home:last-child`, `.home__wrapper`, `[data-cover]` must agree across files; nothing checks it; `:last-child` magic is undocumented |
| **Routes declared twice** | Express `router/` + client `routes[]`, glued only by `html[data-template]` |
| **`router/` + `controllers/` folders are near-empty indirection** | Every GET route renders the same controller and the same template |
| **All transition choreography piles into one file** | glauber-2026's `Transition.ts` is ~620 lines of from→to branches detected via `.closest()` |
| **React used for SSR but thrown away on the client** | glauber-2026 renders React to strings and never hydrates — so all client work happens in a parallel imperative codebase |
| **Magic and prototype pollution** | `AutoBind` in constructors, `NodeList.prototype.map` monkeypatching, magic string ids (`'transition'`), `initElements` returning `null \| HTMLElement \| NodeList` by match count |
| **Custom build stack** | Hand-rolled Rollup CLI + tsup + nodemon + BrowserSync + staticify, CJS output, no type-check gate |
| **Framework/site version drift** | glauber-2026 pins `@lisergia/*@22`, the repo is at 24 — framework improvements never reach sites |
| **Animations are hardcoded values buried in timeline code** | Tweaking a duration means finding the right line inside a 620-line file |

The biggest structural insight: glauber-2026 already *pays for React* (SSR views in `.tsx`)
but gets none of its client-side benefits, forcing every page to exist twice (React view +
imperative class). **Modulato goes full React**: one component is both the markup and the
behavior.

---

## 2. Architecture overview

**Modulato = React 19 + Vite + Hono, with a transition-first router and a persistent
WebGL layer.**

```
┌──────────────────────────────────────────────────────────────┐
│                         modulato site                        │
│                                                              │
│  app.tsx                 ← shell: <Menu/> <WebGLLayer/>      │
│                                   <PageOutlet/>              │
│  pages/home/             ← one folder = one page             │
│    page.tsx                 React component (markup+behavior)│
│    motion.ts                tweakable motion tokens          │
│    config.ts                meta/SEO, loader, assets         │
│    styles.scss              auto-imported, scoped            │
│                                                              │
│  transitions/home__archive.ts   ← one file per route pair    │
│  models/Helmet.tsx              ← typed GLTF components      │
└──────────────┬───────────────────────────────┬───────────────┘
               │ server                        │ client
   @modulato/server (Hono)            modulato (runtime)
   React SSR → full HTML              hydrate once, then
   Node / Vercel / Cloudflare         client routing with
                                      coexisting page trees
               └────────── @modulato/vite ─────┘
        one toolchain: dev server, HMR, route manifest,
        SSR bridge, styles, Tweak Mode injection
```

### Rendering model

- **First load:** Hono server-renders the full React tree to HTML (SEO-complete),
  client hydrates once. Route data comes from `config.ts` loaders (typed).
- **Navigation:** Modulato's own client router. It does **not** blow away the tree like a
  normal SPA router — the `<PageOutlet>` mounts the incoming page *alongside* the outgoing
  one, runs the matched transition choreography, then unmounts the old page (which
  guarantees cleanup of its Lenis, ScrollTriggers, observers). This is the React-native
  version of Lisergia's fetch-and-swap, and it's the part Next/TanStack don't give you.
- **Code splitting per route**, preloaded on link hover/viewport-enter.
- No React Server Components, no streaming in v1 — classic SSR + hydration keeps the mental
  model simple for humans and LLMs alike. Marketing sites don't need RSC.

### Why these foundations

- **React** — your call, and the right one: it's the standard, LLMs are most fluent in it,
  r3f requires it, and it collapses the view/behavior duplication into one component.
- **Vite** replaces the entire custom stack (Rollup CLI, tsup, nodemon, BrowserSync,
  staticify). One dev server, one build, HMR, type-checked builds.
- **Hono** instead of Express: tiny, typed, runs natively on Node, Vercel, Cloudflare
  Workers, Deno, Bun — "deploy anywhere" solved at the server layer.
- **No MobX.** Route state lives in a tiny store (zustand-grade); components use hooks
  (`useRoute()`, `useNavigation()`). Explicit hooks beat implicit reactivity for LLMs.

---

## 3. The conventions (LLM-speed by design)

The core question: *how does an LLM build a page as fast as possible?* Answer: **one
predictable folder, zero registration, contracts checked by the framework, and a CLI that
scaffolds/validates.**

### 3.1 Pages — one folder, one component

```
pages/
  home/                    → route "/"        (folder named `home` = index)
    page.tsx               → the React page component. REQUIRED. Everything else optional.
    motion.ts              → motion tokens: durations, eases, staggers (see §6)
    config.ts              → meta/SEO, data loader, asset preloads, scroll options
    styles.scss            → auto-imported, scoped to `.home` by convention
  archives/                → route "/archives"
  archive/
    [slug]/                → route "/archive/:slug"
      page.tsx
      generate/            → route "/archive/:slug/generate"
        page.tsx
```

- Route = folder path, `[slug]` for params. **No registration anywhere** — `@modulato/vite`
  generates the manifest for server and client from a folder scan.
- `page.tsx` is markup *and* behavior in one place:

```tsx
// pages/home/page.tsx
import { usePage, useIntro } from 'modulato'
import tokens from './motion'

export default function Home({ content }) {
  const page = usePage()               // lifecycle, lenis, transition phase
  useIntro((tl) => {                   // runs after fonts.ready, replayable in Tweak Mode
    tl.from('.home__headline', { yPercent: 100, ...tokens.intro.headline })
  }, tokens)

  return (
    <div className="home">
      <h1 className="home__headline">{content.title}</h1>
    </div>
  )
}
```

- `useIntro` / `useMotion` wrap a GSAP-context-style scope: selectors are scoped to the
  page element, everything auto-reverts on unmount. The `.home:last-child` trick and manual
  `destroy()` bookkeeping become framework internals.
- `config.ts` exports `meta()` (title/OG), `load({ params, content })` (typed props,
  runs server-side on first paint, via data endpoint on client navigation), and
  `assets: []` (GLTF/textures/fonts to preload for this route).

**Adding a page goes from 7 files across 4 concerns → 1 folder; a minimal page is one file.**

### 3.2 Shell — persistent, URL-aware components

`app.tsx` is the one layout file. Everything outside `<PageOutlet/>` persists forever:

```tsx
// app.tsx
export default function App() {
  return (
    <>
      <Menu />                {/* reacts to useRoute() / useNavigation() */}
      <WebGLLayer />          {/* persistent r3f canvas — see §5 */}
      <PageOutlet />          {/* pages mount/unmount here, coexisting mid-transition */}
    </>
  )
}
```

```tsx
// shell/Menu.tsx
const { phase, from, to } = useNavigation()   // 'idle' | 'leaving' | 'entering'
const route = useRoute()
```

This formalizes Lisergia's implicit `onTransitionStart`/`onTransitionEnd` duck-typing into
typed hooks.

### 3.3 Transitions — one file per route pair

```
transitions/
  default.ts               → fallback crossfade
  home__archive.ts         → home → archive (the FLIP thumbnail choreography)
  archive__generate.ts     → archive ↔ generate (the slide, `symmetric: true`)
```

```ts
// transitions/home__archive.ts
import { transition } from 'modulato'
import tokens from './home__archive.motion'

export default transition('home → archive', {
  async run({ from, to, trigger, shared, scene, done }) {
    // from.element and to.element are BOTH mounted — framework guarantees it
    // trigger = the clicked link element (FLIP origin)
    // shared  = matched shared-element pairs with measured rects (FLIP helper)
    // scene   = handle into the persistent WebGL layer (camera/objects) — §5
    // done()  = choreography finished; framework unmounts `from`
  },
})
```

- Pair resolution: exact `home__archive` → wildcard `*__archive` → `default`. No more
  `.closest('.home')` sniffing.
- **Shared-element FLIP built in:** pages mark elements via
  `<Shared id={`cover:${slug}`}>…</Shared>` (or `useTransitionHandle('cover', ref)` for
  addressing arbitrary elements from the pair file — no selector strings). The framework
  measures both rects and hands you a ready-to-tween record; glauber-2026's ~100 lines of
  clone/measure/aspect-ratio math plus its `.measure-grid` hack become framework code.
- Intros use the same system (`useIntro` per page). The 620-line `Transition.ts` decomposes
  into ~5 files of 60–120 lines.

### 3.4 Behaviors — hooks first, enhancers for raw HTML

With React, reusable animation behaviors are **hooks and components**, not selector scans:

```tsx
<Reveal><img … /></Reveal>          // or:
const ref = useReveal(tokens.reveal)
```

One exception kept from Lisergia: **enhancers** for HTML you don't control (CMS rich
text / portable text rendered as raw HTML):

```ts
// behaviors/reveal.enhancer.ts — auto-applied to matching nodes inside rendered CMS HTML
export default enhance('[data-reveal]', ({ element, data, page }) => { … })
```

Same mount/destroy guarantees, scoped to the page, auto-discovered from `behaviors/`.

### 3.5 Server functions & forms

Colocated `server.ts` in a page folder, TanStack-Start-flavored but minimal:

```ts
// pages/contact/server.ts
export const subscribe = action(async ({ form }) => { /* server-only, secrets safe */ })
```

`<form action={subscribe}>` renders a real form (works without JS); the client intercepts
for animated feedback. Covers newsletter/Klaviyo-style needs without an RPC framework.

---

## 4. The CLI — `modulato`

A real CLI, shipped as the `modulato` package bin. Two audiences, two design rules:
**generate deterministically for humans, introspect/validate machine-readably for agents.**

```
modulato dev                       # vite dev server (client + SSR)
modulato build                     # production build
modulato content                   # pull CMS → content snapshot + typegen (§7)

modulato new page archive/[slug]   # scaffold page folder (page.tsx, motion, config, styles)
modulato new transition home archive
modulato new behavior parallax
modulato new model helmet.glb      # gltf-transform optimize (draco/ktx2) + gltfjsx →
                                   #   typed <Helmet/> component in models/  (§5)

modulato routes --json             # route manifest
modulato tokens [route] --json     # motion tokens registry
modulato check                     # validate contracts: orphan styles, unused tokens,
                                   #   transition pairs referencing missing pages,
                                   #   shared-element ids that don't match across a pair
```

**Is a CLI faster for LLMs?** Honest answer: for *writing files*, no — an LLM writes a
`page.tsx` as fast as it invokes a command. The CLI wins for LLMs in three other ways:

1. **Determinism** — `modulato new page` gets every name, path, and convention right in one
   shot; no drift between what the LLM remembers and what the framework expects.
2. **Validation as a cheap tool call** — `modulato check` after edits catches broken
   contracts (the class of bug that's invisible until runtime in Lisergia). Agents run it
   like a type-checker.
3. **Machine-readable introspection** — `--json` everywhere means an agent asks the
   project what exists instead of globbing and guessing.

Docs will tell agents: scaffold with `new`, edit files directly, always finish with
`modulato check`. Processing pipelines (`new model`) are CLI-only because they run real
binaries (gltf-transform) an LLM shouldn't reimplement.

---

## 5. The 3D layer — `@modulato/three`

The requirement: use Three.js/r3f when a project needs it, load GLTF models, and have 3D
objects **animate/change state between pages** — without compromising the framework style.
The design makes WebGL a *shell citizen*, exactly like the Menu:

### One persistent canvas, pages contribute scenes

- **`<WebGLLayer>`** mounts a single r3f `<Canvas>` in `app.tsx` — created once, never
  destroyed on navigation. Its frameloop is coordinated with Lenis on the framework's
  single RAF ticker (Lisergia's Tempus role).
- **Pages inject 3D content via portals** (the pmndrs tunnel pattern): a page renders
  `<Scene>…r3f elements…</Scene>` in its normal JSX, and that content is portaled into the
  persistent canvas. Because navigation keeps both pages mounted mid-transition, **both
  pages' 3D content coexists in the scene during the transition** — you can tween cameras,
  cross-morph materials, and hand objects from one page to the next.
- **`<ModelView>`** (drei `View`-based) for DOM-tracked viewports: a 3D object rendered
  "inside" a section, tracking its DOM rect as it scrolls — while still living in the one
  shared canvas (one WebGL context, no context churn between pages).

### GLTF workflow

```
modulato new model helmet.glb
  → optimizes (gltf-transform: draco compression, ktx2 textures, prune/dedupe)
  → generates models/Helmet.tsx via gltfjsx: a typed component exposing named
    nodes/materials as props/refs
```

```tsx
// shell/HeroObject.tsx — a PERSISTENT 3D element that changes state per URL
export function HeroObject() {
  const ref = useRef<Group>(null)
  useSceneState(ref, {                      // token-driven, tweakable in Tweak Mode
    home:      { position: [0, 0, 0],   scale: 1,   rotation: [0, 0, 0] },
    archive:   { position: [2.4, 0.5, -1], scale: 0.4 },
    archives:  { visible: false },
  }, tokens.hero)                           // duration/ease per state change
  return <Helmet ref={ref} />
}
```

`useSceneState` is the WebGL twin of the persistent-menu pattern: declare per-route states
as **data** (so Tweak Mode can edit them, §6), and the framework tweens between them during
navigation — in sync with the DOM transition, because transition files also receive the
`scene` handle for bespoke choreography (camera rigs, uniforms, etc.).

- Route `config.ts` declares `assets: ['/models/helmet.glb']` → preloaded on link
  hover/viewport-enter alongside the route's JS chunk. drei's `useGLTF.preload` under the
  hood.
- **Zero cost when unused:** `@modulato/three` is a separate package; sites without 3D
  never ship React Three Fiber. `create-modulato` asks "3D? (none / three)".

---

## 6. Tweak Mode — the killer feature

The requirement: tweak animation values live, replay/loop/slow-mo, then **save back to the
source file**.

### Motion tokens make it possible

Animations read their numbers from colocated, serializable token modules:

```ts
// pages/home/motion.ts
export default motion({
  intro: {
    headline: { duration: 1.2, ease: 'expo.out', stagger: 0.08, y: 120 },
    grid:     { duration: 0.9, ease: 'expo.inOut', stagger: 0.05 },
  },
  exit: { fade: { duration: 0.4 } },
})
```

Because tokens are **data, not code** (and `useSceneState` route-states are too):

1. **The Tweak overlay** (dev only, injected by `@modulato/vite`): a floating panel listing
   every token group active on the current page — sliders/steppers, ease picker with curve
   preview, and controls: **Replay · Loop · 0.1×–1× slow-mo · fire enter/exit/transition on
   demand** (`useIntro`/`useMotion`/transitions are re-runnable by construction; slow-mo is
   GSAP `timeScale`). Edits apply instantly via HMR token injection.
2. **Save** writes values back into `motion.ts` through a Vite dev-server middleware —
   AST-preserving edit (magicast-style), not regex. No MCP required for the local path.
3. **`@modulato/mcp`** exposes the same registry to Claude/agents: `list_motion_tokens`,
   `set_motion_token`, `replay(page, phase)`, `list_routes`, plus the CLI's scaffold/check
   operations. You tweak by hand in the overlay, or Claude tweaks via MCP — same files.

Non-token animation code still works (it's just GSAP); it simply doesn't appear in the
overlay. Convention nudges toward tokens.

### Animation engine: GSAP, sole engine (decided 2026-07-10)

One engine, not two — maintaining dual scaffolds, dual glue packages, and dual docs would
tax every phase for little gain. The evaluation (GSAP 3.13+ vs anime.js v4):

| Criterion | GSAP | anime.js v4 | Winner |
|---|---|---|---|
| LLM fluency | v3 API stable since 2019; massive, consistent training data; official Claude skills exist | v4 (2025) was a breaking rewrite — LLMs routinely hallucinate v3 syntax (`anime({targets})` vs v4 `animate()`) | **GSAP** |
| Responsive API | `gsap.matchMedia()` — per-breakpoint scopes, auto revert + re-run on change, `prefers-reduced-motion` built in | `createScope({ mediaQueries })` — equivalent semantics, elegant | tie |
| Scroll choreography | ScrollTrigger: pinning, scrub, batch — industry standard | `onScroll()` — newer, lighter, no real pinning story | **GSAP** |
| Text splitting | SplitText (rewritten in 3.13: 50% smaller, a11y baked in, masking) | v4.1 text utilities | **GSAP** |
| License / cost | 100% free incl. all former Club plugins since April 2025 (Webflow) | MIT | tie (anime purer, GSAP no longer restricted) |
| Bundle size / modularity | Monolithic-ish (~70kb+ with plugins) | Modular, tree-shakeable, much smaller | anime |

Bundle size is anime's one real win, and for animation-first marketing sites it's the
criterion that matters least. **Decision: GSAP.** The framework contracts stay
Promise/`done()`-based (engine-agnostic by shape), so this is contained in one glue
package — `@modulato/gsap`: Lenis↔ScrollTrigger sync, SplitText cleanup on unmount,
page-scoped ScrollTrigger killing, timeScale for Tweak Mode, and the matchMedia bridge
below. If the engine ever needs to change, the blast radius is that package plus token
resolution — not user code conventions.

### Responsive motion — the Viewport, rebuilt

Lisergia's `ViewportManager` (breakpoint constants, `isPhone/isTablet/isDesktop`,
`--100vh`) becomes three framework-level pieces, **written once and engine-independent** —
this is the "anime scopes" ergonomics you wanted, implemented above the engine:

1. **Breakpoints defined once** in `modulato.config.ts`:
   ```ts
   breakpoints: { phone: '(max-width: 767px)', tablet: '(768px <= width < 1280px)' }
   ```
   Exported everywhere from that single source: TS (`useViewport()`), generated SCSS
   variables / custom media, token resolution, and the Tweak Mode overlay.
2. **Responsive motion tokens** — any token group takes per-breakpoint overrides,
   deep-merged over the base:
   ```ts
   // pages/home/motion.ts
   intro: {
     headline: {
       duration: 1.2, ease: 'expo.out', stagger: 0.08, y: 120,
       phone:  { y: 40, duration: 0.8, stagger: 0.04 },
       reduced: { duration: 0 },          // prefers-reduced-motion is a breakpoint too
     },
   }
   ```
   `useIntro`/`useMotion`/`useSceneState`/transitions receive **already-resolved** tokens
   for the current viewport. On breakpoint change the framework reverts and re-runs the
   scoped animations (implemented on `gsap.matchMedia()` internally — its revert semantics
   are exactly right — but no user code ever calls it). One mental model: *write the
   animation once, vary the numbers per breakpoint.*
3. **`useViewport()`** for the cases that need logic, not just numbers:
   `{ width, height, dpr, isPhone, isTablet, isDesktop, reducedMotion }`, reactive. And the
   `--100vh` hack is deleted — modern `dvh/svh` units cover it; the framework just sets
   `html` sizing correctly in its base styles.

Tweak Mode gets a **breakpoint switcher**: toggle phone/tablet/desktop/reduced in the
overlay, see resolved values, edit a breakpoint's override, replay — Save writes the
override into the right nested key of `motion.ts`.

---

## 7. Content layer (CMS)

An **adapter interface with build-time snapshot + typegen**, formalizing what both Lisergia
sites already do (`download.ts` → `content.json`):

```ts
// modulato.config.ts
content: sanity({ project, dataset, resolveReferences: true })
// or: localJson({ dir: 'content/' })     ← glauber-2026's actual setup
// or: none
```

- `modulato content` pulls, denormalizes references (Lisergia's `traverse()` pattern
  generalized), writes a snapshot **plus TypeScript types** — `load({ content })` is fully
  typed, so LLMs autocomplete the CMS shape.
- Build-time snapshot by default (fast, cacheable, SEO-safe); optional `mode: 'live'` for
  request-time fetching where the platform allows.
- **Live mode design (decided 2026-07-11):** because loaders receive `content` as an
  argument (never import the snapshot), live mode is a config flag, not a code change:
  `sanity({ …, mode: 'live', revalidate: 60 })`. Server fetches the adapter per request
  through an in-memory stale-while-revalidate cache (Sanity CDN ~50–150ms, mostly warm);
  client navigations fetch `/__modulato/content` instead of reading the bundle. Publishes
  go live within `revalidate` seconds — no webhook, no redeploy. Ships WITH
  `@modulato/content-sanity` (proving it needs a real remote adapter). True real-time
  (listeners / Live Content API) is an editor-preview feature, later. The KV-webhook
  middle path (instant + snapshot-fast) stays out of core: platform-specific infra.
- Shipped adapters: `@modulato/content-sanity`, `@modulato/content-local`. The interface is
  ~4 functions — community/LLM-written adapters are trivial.
- `<Img>` component: emits lazy-loading markup + aspect-ratio placeholder wired to the
  built-in image behavior (replaces `probe-image-size` + `dimensions-cache.json`).

---

## 8. LLM-experience strategy (the actual differentiator)

1. **One-folder-per-page + zero registration** — an LLM materializes a page in one Write.
2. **One language, one paradigm** — React + TS everywhere (server views, client behavior,
   3D). No Twig, no parallel imperative codebase.
3. **Rigid, derivable naming** — folder name → root class → style scope → transition key —
   validated by `modulato check` with error messages that teach ("Transition
   `home__archive` references shared id `cover:x` that exists only on the home side").
4. **Docs written for machines first:**
   - `llms.txt` + `llms-full.txt` on modulato.org.
   - **`MODULATO.md`** — the complete API reference as a single ~1,500-line file, copied
     into every scaffolded project. LLMs read it in one gulp; the human docs site is
     generated *from* it.
   - A **Claude Code skill** (`/modulato`), mirroring the existing `/lisergia` skill.
   - Scaffolded projects get `CLAUDE.md`/`AGENTS.md` pre-filled: "scaffold with
     `modulato new`, edit directly, finish with `modulato check`."
5. **Introspectable everywhere:** CLI `--json` commands, dev-mode `window.__MODULATO__`
   (current route, mounted pages, active tokens, last transition timing), and the MCP
   server. An agent can *ask the project and the running site* instead of grepping.
6. **Typed everywhere:** generated route types, content types, GLTF component types.
   Autocomplete is LLM guidance too.

---

## 9. Repo layout

```
modulato/                      (this folder — one git repo, npm workspaces + turborepo)
  PLAN.md                      ← this document
  framework/
    core/                      → npm: `modulato`          (router, PageOutlet, hooks, tokens, CLI bin)
    vite/                      → npm: `@modulato/vite`     (plugin: manifest, SSR bridge, styles, tweak inject)
    server/                    → npm: `@modulato/server`   (Hono SSR, adapters: node/vercel/cloudflare)
    three/                     → npm: `@modulato/three`    (WebGLLayer, Scene, ModelView, useSceneState, gltf tooling)
    tweak/                     → npm: `@modulato/tweak`    (overlay UI + file-writeback middleware)
    content-sanity/            → npm: `@modulato/content-sanity`
    content-local/             → npm: `@modulato/content-local`
    gsap/                      → npm: `@modulato/gsap`     (sole engine glue — see §6)
    mcp/                       → npm: `@modulato/mcp`
    create/                    → npm: `create-modulato`    (prompts: styles · content · 3D · deploy)
  examples/
    demo/                      ← the 3-page proving ground (§10)
    starter/                   ← what create-modulato emits
  docs/
    MODULATO.md                ← single-file LLM reference (source of truth)
    site/                      ← modulato.org (built with modulato itself, eventually)
```

Examples consume `framework/*` as **workspace deps** — no version drift between framework
and reference site (the 22-vs-24 problem), and every framework change is validated against
the demo site immediately.

### Distribution & repo privacy (decided 2026-07-11)

The GitHub repo stays **private** until the framework is ready; npm is the public
distribution channel. Already claimed: `modulato@0.0.1` placeholder + the `@modulato` org
(scope fully reserved). At first real release (0.1.0):

- Framework packages publish from the private repo (tsup build step first — exports
  currently point at raw TS source, which only works inside the workspace).
- **Examples ship as `@modulato/examples`** — a published package of template folders.
  `create-modulato` fetches its tarball from the registry at scaffold time (NOT bundled,
  NOT degit-from-GitHub — the repo is private) and unpacks the chosen template onto the
  user's machine, rewriting package.json to point at published versions. Version-pinned
  to the framework release so examples always match. Publishable only alongside 0.1.0,
  since examples import the framework.
- Revisit making the repo public at/after launch: npm provenance attestation, Socket/Snyk
  trust scores, and LLM-first adoption all favor an eventually-public repo.

---

## 10. The proof: `examples/demo` — a 3-page showcase site

The acceptance test for every phase: a **simple, purpose-built 3-page site** with dummy
content and images, exercising every framework concept without a real site's complexity.
(Rewriting glauber-2026 stays as an optional stretch goal once the framework is stable —
it's a great stress test but too complex to be the proving ground.)

```
examples/demo/
  app.tsx                          ← <Menu/> <Marker/> <WebGLLayer/> <PageOutlet/>
  shell/
    Menu.tsx                       ← persistent nav; active-link indicator SLIDES between
                                     items on navigation (state change via useNavigation)
    Marker.tsx                     ← a persistent decorative shape that REPOSITIONS,
                                     rescales, and recolors per route via data-driven
                                     states — the "element that moves while you navigate"
  pages/
    home/{page.tsx, motion.ts, config.ts, styles.scss}
                                   ← headline text-reveal intro, image grid (dummy images
                                     via picsum), staggered reveals
    work/
      {page.tsx, ...}              ← route "/work": card grid; each card is a
                                     <Shared id={`cover:${slug}`}> image
      [slug]/{page.tsx, ...}       ← route "/work/:slug": detail page, the card image
                                     FLIPs into the hero cover
    about/{page.tsx, ...}          ← route "/about": text-heavy page, scroll-linked
                                     parallax images, marquee
  transitions/
    default.ts                     ← crossfade
    work__work-slug.ts             ← shared-element FLIP (card → hero), symmetric
    home__about.ts                 ← full-screen slide
  content/                         ← dummy local JSON through @modulato/content-local
  modulato.config.ts               ← breakpoints, content adapter
```

What it must demonstrate, per phase:

- **Navigation & persistence:** Menu indicator and Marker visibly change state/position on
  every route change — the Lisergia signature move, in miniature.
- **Transitions:** crossfade default, one slide, one shared-element FLIP.
- **Mobile-first responsiveness:** every intro/transition has `phone` token overrides
  (smaller travel distances, shorter durations, tighter staggers); layouts collapse
  properly; verified at phone/tablet/desktop in the in-app browser. `reduced` overrides
  respected.
- **Tweak Mode:** all of the above tunable live, per breakpoint, with Save writeback.
- **3D (Phase 8):** a small GLTF object added to the Marker via `<WebGLLayer>` +
  `useSceneState` — it moves/rescales between the three routes in sync with the DOM
  transition. This keeps the 3D proof inside the same demo instead of a separate example.
- **Boring infrastructure proof:** `modulato check` passes, deploys to Vercel, view-source
  HTML is complete for SEO, Lighthouse doesn't embarrass us.

---

## 11. Build order (phases)

Each phase ends with something runnable in `examples/`.

> **STATUS (2026-07-10):** Phases 0–2 ✅ done and verified, plus most of Phase 3
> (transition pair files, `<Shared>` FLIP, per-page intros, the four-moment no-flicker
> lifecycle) and dev CSS inlining (FOUC fix). npm names claimed under `glauberxyz`.
> Phase 2 landed as: `usePage()`/`useScroll()` + per-page Lenis on the framework's
> single RAF ticker (created on mount, stopped during transitions, destroyed on
> unmount; per-page `scroll` config), `behaviors/` enhancers with auto-discovery,
> dev contract warnings, **`@modulato/gsap`** with `useMotion` (gsap.context scoping,
> auto-revert — verified: an infinite marquee tween dies with its page), and **shell
> intros** (root `intro.ts` choreographing the persistent Menu/Marker on first load —
> the gap glauber-2026 exposed; the server hide-style widens to `#__modulato` when it
> exists). GSAP is now in the demo (SplitText text-reveal intro on home).
> Note: per-page intros are FILE-based (`intro.ts`), not the `useIntro` hook sketched
> in §3.1 — first-load choreography is a file concern like transitions; revisit only
> if Tweak Mode needs otherwise.
> **Deploy milestone ✅ (build side):** production build works — `vite build && vite
> build --ssr` through `@modulato/vite` (client: hashed assets + manifest into
> dist/client; ssr: fully-bundled server module into dist/server with the client's
> hashed asset URLs + stylesheet links baked into the server entry). With `VERCEL=1`
> (or `vercel: true`) the plugin emits **Build Output API v3** (`.vercel/output`:
> static + one `__ssr` Node function + immutable asset caching). Verified locally via
> `npm run preview` (examples/demo/preview.mjs serves the output Vercel-style): SSR
> HTML complete, styled first paint, hydration + client routing + intros all work.
> **Deployed to production: https://modulato-demo.vercel.app** (verified live: SSR on
> dynamic routes, 404s, immutable asset caching).
>
> **Phase 4 ✅ (CLI, 2026-07-11):** `modulato` bin ships from the core package —
> `dev`/`build` (vite passthrough, build runs both passes), `new page/transition/
> behavior/intro` (deterministic scaffolds, refuse-to-overwrite, unknown-route
> errors that list known routes), `routes [--json]`, `check [--json]` (orphan
> companion files, missing default exports, malformed/dangling transition pairs,
> missing `<PageOutlet/>`, misplaced intro.ts — teaching messages, exit 1). Demo
> scripts dogfood it. Not yet: `tokens` (Phase 5 — no token registry), `new model`
> (Phase 8), `content` (Phase 6).
> **Phase 5 ✅ core (Tweak Mode, 2026-07-11):** `motion()` token modules
> (`motion.ts`, auto-registered in dev via a self-registering transform; identity
> function in prod — zero cost, verified absent from the bundle). Dev registry with
> live in-place mutation (consumers hold the object → edits apply to the next
> replay), dirty-tracking, reset, HMR merge that PRESERVES object identity.
> `window.__MODULATO__` handle (route, tokens, speed, replayIntro/replayShellIntro/
> replayMotions). **@modulato/tweak**: overlay (per-module token editors, replay
> intro/shell/motions, loop, 1×–0.1× slow-mo via WAAPI playbackRate + GSAP
> timeScale) + magicast writeback middleware (`POST /__modulato/tokens`,
> AST-preserving — comments/formatting survive; verified round-trip: edit → save →
> file diff exact → HMR merge → dirty clears). `useMotion` re-runs on replay events.
> Demo tokenized: shell (root motion.ts), home intro, about marquee/parallax.
> Still open from §6: responsive per-breakpoint token overrides + breakpoint
> switcher (needs modulato.config.ts breakpoints — do with Phase 7's responsive
> pass), transition replay from the overlay, and **@modulato/mcp** (next).
> **@modulato/mcp ✅ (2026-07-11):** stdio MCP server (`modulato-mcp` bin; register
> with `claude mcp add modulato -- npx modulato-mcp` from the site root). Tools:
> `list_routes`, `check`, `scaffold_page/transition/behavior/intro` (same
> implementation as the CLI via the `modulato/cli` export), `list_motion_tokens`
> (static AST read — handles negative literals), `set_motion_tokens` (same
> magicast writeback as the overlay; dev-server HMR makes the file edit a LIVE
> edit), `replay` (intro/shell/motions) and `set_speed` — the last two relay
> through `POST /__modulato/replay`, which the dev server broadcasts to the page
> over its own websocket (verified end-to-end). Token utilities shared in
> `@modulato/tweak/tokens`.
> **Phase 6a ✅ (content layer, 2026-07-11):** `modulato.config.ts` (imports from
> **`modulato/config`** — a Node-runnable subpath, since the CLI loads the config
> via vite's `loadConfigFromFile` outside vite). ContentAdapter interface
> (`{ name, pull({root}) → snapshot }`); **@modulato/content-local** (content/*.json
> → snapshot keys). `modulato content` writes `.modulato/content.json` (commit it —
> reproducible builds) + `.modulato/content.d.ts`, which augments **ModulatoContent
> via `declare module 'modulato/config'`** (augmentation must target the declaring
> module, and the tsconfig needs the explicit `.modulato/content.d.ts` include —
> TS globs skip dot-dirs). Loaders get `content` (typed) in LoadArgs, same data
> server- and client-side via `virtual:modulato/content` (bundled into both prod
> outputs; snapshot changes hot-reload in dev). `<Img>`: lazy + async-decoded +
> aspect-ratio (no CLS) + fade-in on load, plain <img> without JS. Demo migrated:
> content/projects.json drives all three pages; `Project` type DERIVES from the
> generated content types. Demo also has a CLAUDE.md agent guide now.
> Still open in Phase 6: **server actions** (`action()` + colocated server.ts +
> progressive forms) — needs a contact-ish demo page. @modulato/content-sanity
> deferred until a real Sanity project exists to test against.
> **Phase 6b ✅ (server actions, 2026-07-11):** `action()` in colocated
> `pages/*/server.ts`. The build enforces the server boundary: client imports of
> server.ts are REPLACED with URL stubs (with the sourcemap chain broken so
> sourcesContent can't leak the original — caught in verification), while SSR keeps
> the real handlers decorated with their URLs, so SSR-rendered forms carry working
> action attributes. One Node runner (`nodeAction` in @modulato/server, web
> Request/FormData parsing) serves the dev middleware and the Vercel function.
> Content negotiation: fetch clients get `{ ok, data|error }` JSON; no-JS posts get
> 303 PRG redirects (referer or handler `{ redirect }`). `useFormAction(ref)` gives
> progressive forms: real action attrs + fetch interception + idle→pending→ok|error
> state, `data` typed from the handler's return type. Demo: subscribe form on
> /about, verified in dev, prod (Vercel launcher) and no-JS paths.
> **Phase 7 ✅ (responsive system + demo completion, 2026-07-11):** Breakpoints
> defined once in modulato.config.ts, statically AST-extracted for the client
> (`virtual:modulato/breakpoints` — no node-only adapter code leaks into the
> bundle; must be literal strings). Core viewport store: reactive `useViewport()`
> (width/height/dpr/breakpoint/reducedMotion + isPhone/isTablet/isDesktop),
> SSR-safe. **`resolveTokens(tokens)`**: per-breakpoint override blocks
> (`phone:`/`tablet:`/custom) deep-merge over the base, `reduced` merges last —
> called at animation-run time so replays and breakpoint changes read fresh
> values. `useMotion` reverts + re-runs on breakpoint/reduced change. Tweak
> overlay gained the breakpoint switcher (auto/phone/tablet/desktop + reduced) —
> forced via dev-only viewport overrides. Transition pair files can colocate
> tokens as `<pair>.motion.ts` (excluded from the pair scan, included in the
> registry/CLI/MCP). Demo: home__about full-screen slide (symmetric, tokenized,
> phone+reduced overrides), phone/reduced overrides on shell + home intros,
> about marquee (reduced → no loop) + parallax (phone weaker, reduced off),
> layouts verified at phone (single-column, clean type scale).
> Deferred from §6: generated SCSS breakpoint variables/custom-media (do with
> the styling story in Phase 9); per-breakpoint OVERLAY EDITING of un-nested
> keys is implicit (leaves include phone.* paths already).
> **Phase 8 → REDESIGNED as "integration surface", ✅ (2026-07-11).** Decision
> (user): no @modulato/three, no baked-in 3D features. Modulato's job is to feed
> ANY custom component (r3f scene, canvas, cursor) with what's going on: route +
> navigation phase (useRoute/useNavigation — already shell-safe), viewport +
> breakpoints (useViewport), motion tokens (resolveTokens, tweakable live), and —
> the gap this closed — **scroll and frames in the shell**: `useScroll` now works
> outside pages via a site-wide scroll bus (every page Lenis pipes into it, so a
> persistent subscriber survives navigations), and **`useTicker`** gives per-frame
> callbacks on the single RAF ticker with auto-cleanup. `ticker.advance()` +
> dev `__MODULATO__.tick()` allow rAF-less verification. Proof in the demo:
> shell/Scene.tsx — a persistent canvas square that rotates with the active
> page's scroll, spins faster + scales down while any transition runs, all
> numbers in root motion.ts (responsive + reduced-motion + overlay-tweakable).
> An r3f scene consumes the identical surface — document the recipe in
> MODULATO.md (Phase 9). §10's "3D (Phase 8)" checklist item is superseded.
> **Phase 9 ✅ prep (2026-07-11) — publish awaits the user's `npm publish`.**
> DECISION: packages **publish from TS source, no tsup** — Modulato requires
> vite, and vite transforms framework TS from node_modules in every mode we use
> (dev, client build, SSR build); TS consumers typecheck against src via the
> exports map. Verified end-to-end with a scaffolded project (check + tsc + dev
> SSR + prod build all green against workspace-linked packages). Node-facing
> entries (CLI, config, adapters, MCP) were already plain .mjs. Revisit tsup as
> pre-1.0 hardening if a non-vite surface ever appears.
> Shipped: **MODULATO.md** (docs/, ~350 dense lines, the whole API in one read;
> copied into create-modulato — `npm run sync:docs` after edits);
> **create-modulato** (non-interactive: one arg, --json, atomic, no side
> effects; starter = 2 pages + slide transition + shell intro + tokens with
> phone/reduced overrides + typed content pre-pulled + CLAUDE.md + MODULATO.md;
> template ships `gitignore` dotless — npm strips .gitignore); all 8 packages
> at 0.1.0 with MIT license (⚠ user to confirm), files fields, READMEs,
> explicit ^0.1.0 ranges — `npm pack --dry-run` clean, whole framework <90 kB
> unpacked. `create-modulato` npm name confirmed unclaimed.
> Publish (user, from repo root, npm login as glauberxyz first):
> `for p in core vite server gsap tweak content-local mcp create; do (cd framework/$p && npm publish --access public); done`
> Still open: modulato.org + llms.txt hosting, /modulato Claude skill,
> Tailwind scaffold option, Cloudflare adapter, @modulato/content-sanity
> (+ live mode). Optional stretch: rewrite glauber-2026 on Modulato.

- **Phase 0 — Skeleton.** Monorepo scaffolding (workspaces, turbo, tsconfig, vitest,
  changesets), claim `modulato` + `@modulato` on npm with 0.0.1 placeholders.
- **Phase 1 — SSR + router walking skeleton.** `@modulato/vite` route manifest from
  `pages/`, `@modulato/server` React SSR on Node, client hydration, `<PageOutlet>` with
  coexisting page trees, default crossfade, popstate + scroll restore, meta sync, per-route
  code splitting. *Deliverable: 2-page site with working back/forward.*
- **Phase 2 — Page lifecycle + motion hooks.** `usePage`, `useIntro`/`useMotion`
  (GSAP-context scoping, auto-revert), Lenis per page on one ticker, enhancers, dev-mode
  contract warnings. *Deliverable: reveal/text-reveal/image running.*
- **Phase 3 — Transition system.** Pair resolver, `<Shared>`/`useTransitionHandle`, FLIP
  helper, `@modulato/gsap` glue (ScrollTrigger scoping, SplitText cleanup).
  *Deliverable: home→archive FLIP clone working.*
- **Phase 4 — CLI.** `modulato new page/transition/behavior`, `routes/tokens --json`,
  `check`. (Early because every later phase benefits from scaffolding + validation.)
- **Phase 5 — Tweak Mode.** Token registry, overlay UI (replay/loop/slow-mo), AST
  writeback, then `@modulato/mcp`.
- **Phase 6 — Content + server actions.** Adapters, typegen, `<Img>`, `action()` forms.
- **Phase 7 — Complete `examples/demo`** (§10) — all three pages, all three transitions,
  persistent Menu indicator + Marker, full responsive token coverage verified at
  phone/tablet/desktop, Tweak Mode driving all of it. Battle-tests everything; fixes feed
  back. (Optional stretch, post-1.0: rewrite glauber-2026 as a second, harder example.)
- **Phase 8 — 3D layer.** `@modulato/three`: WebGLLayer, Scene portals, ModelView,
  `useSceneState`, `modulato new model` (gltf-transform + gltfjsx), asset preloading.
  *Deliverable: a GLTF object joins the demo's Marker and morphs between the three routes,
  in sync with DOM transitions, responsive tokens included.*
- **Phase 9 — DX shell + publish.** `create-modulato` (styles · content · 3D · deploy
  prompts), Tailwind option, deploy verified on Vercel + Cloudflare, `MODULATO.md` +
  `llms.txt` + `/modulato` skill, real versions to npm, modulato.org.

---

## 12. Open decisions (defaults chosen, easy to revisit)

| Decision | Default | Alternative |
|---|---|---|
| Animation engine | **GSAP, sole engine** (decided — see §6) | anime.js v4; revisit only if GSAP licensing regresses |
| React flavor | React 19, classic SSR + hydration | RSC/streaming later if ever needed |
| Styling default in scaffolder | SCSS (your muscle memory + `@lisergia/styles` port) | Tailwind as default instead |
| View Transitions API | Not used for core (JS-driven = full control + Safari parity) | Progressive layer later for simple fades |
| Router store | tiny internal store + hooks | expose zustand publicly |
| 3D transitions default | `useSceneState` data-driven states | always-bespoke in transition files |
| Monorepo orchestrator | turborepo (familiar from Lisergia) | plain npm workspaces |
```
