# MODULATO.md — the complete reference

> Modulato is a visual-design-first React framework for making websites,
> leveraging custom transitions and animations. This file is the entire API
> surface in one read —
> written for humans and language models alike. If you are an agent: create a
> site with `npm create modulato@latest <dir>`, scaffold INSIDE one with
> `npx modulato new page|transition|behavior|intro`, edit files directly, and
> ALWAYS finish with `npx modulato check`. (`modulato new` needs an existing
> site — it is the in-project scaffolder, not the site creator.)

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
  type.ts                      ← OPTIONAL typography tokens (the site's type system)
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
// `restore` is scroll memory, session-only — a fresh landing always starts at
// the top:
//   true    link navigations BACK to this page land where it was left
//           (grid → detail → back-to-grid). Back/Forward restore too.
//   false   this page ALWAYS opens at the top, Back and Forward included —
//           for a page whose opening is choreographed, where a restored
//           position would put the choreography off-screen.
//   omitted link navigations start at the top, Back/Forward restore.
export const scroll = { lerp: 0.08, restore: true }
```

Override it for a single navigation with
`useRouter().navigate(path, { restoreScroll: true })` — how a detail view
returns the reader to the exact place in the list it was opened from, even
when that list declares `restore: false`.

`load` runs server-side for the first paint and client-side on navigations —
same code, same `content` snapshot. `meta` sets title/description (SSR +
client title sync).

**`ctx.request` — server-only, and `undefined` otherwise.** Because `load`
runs in both places, the request exists on the first paint and not when a
reader reaches the same page by clicking a link. Code that reads it must
handle both, and it can never hold a secret: whatever you derive from it
becomes props, and props ship to the client.

```ts
export function load({ request, params }: LoadArgs) {
  if (!request) return fetch(`/api/project/${params.slug}`).then((r) => r.json())
  return db.project(params.slug)          // first paint — no round trip
}
```

`modulato check` **errors** on a `load()` that reads `request` without a guard
(an early `if (!request)` or `request?.`). Unguarded it throws on the first
link click and not before, which is the one order nobody tests in.

### Styles & design tokens

Design values are data, same philosophy as motion tokens — they live in one
place and everything references them:

```
styles/
  tokens.scss      ← colors, fonts, shared values, as CSS variables on :root
  typography.scss  ← every text style, as SCSS mixins
  global.scss      ← reset + base; @use './tokens'
```

```scss
// styles/tokens.scss
:root {
  --fg: #231f20;
  --muted: #7a7a75;
  --font-sans: 'franklin-gothic-urw', sans-serif;
}

// styles/typography.scss — one mixin per text style in the design
@mixin headline { font-family: var(--font-sans); font-size: clamp(3rem, 8vw, 6.5rem); line-height: 1; }
@mixin copy { font-family: var(--font-sans); font-size: 14px; line-height: 1.3; }

// pages/home/styles.scss — layout only; type comes from the shared mixins
@use '../../styles/typography' as type;
.home__title { @include type.headline; margin: 0; }
```

The rules, non-negotiable for consistency:

- **Introducing a color?** Add a CSS variable to `tokens.scss` FIRST, then
  `var(--name)` everywhere. Never hardcode a hex in a page stylesheet.
- **Touching typography?** The change belongs in a `typography.scss` mixin —
  if a text style doesn't have one yet, create it there, then `@include` it.
  Page stylesheets never declare `font-*`/`letter-spacing`/`line-height`
  directly.
- Page `styles.scss` files are for LAYOUT (position, spacing, size). If two
  pages would repeat a declaration, it belongs in `styles/`.
- CSS variables (not SCSS variables) for anything with a runtime life:
  themes, and JS/WebGL reading brand colors via `getComputedStyle`.


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
| `useRoute()` | anywhere | committed route `{ id, path, params }` — the PATHNAME, no query |
| `useSearchParam(key)` | anywhere | `[value, set]` for one query param — reactive read, SHALLOW write (no remount). `null` on the server and through hydration |
| `useSearchParams()` | anywhere | the whole query as `{ key: value }`, same contract — empty on the server and through hydration |
| `useNavigation()` | anywhere | `{ phase, from, to }` — `to` is set from navigation start |
| `usePage()` | inside a page | `{ route, phase: 'entering'\|'active'\|'leaving', element, lenis }` |
| `useScroll(cb)` | anywhere | smooth-scroll frames `{ scroll, limit, velocity, progress }`. Inside a page: that page's scroll. In the shell: the ACTIVE page's scroll, surviving navigations |
| `useTicker(cb)` | anywhere | per-frame `(time, delta)` on the single RAF ticker, auto-cleaned. Runs on the motion clock: dev slow-mo scales `delta`, and `time` advances by the scaled deltas |
| `useViewport()` | anywhere | reactive `{ width, height, dpr, breakpoint, reducedMotion, isPhone, isTablet, isDesktop }` |
| `useFormAction(ref)` | inside a page | progressive server-action form wiring (§10) |
| `useMotion(fn)` | inside a page — from **@modulato/gsap** | page-scoped `gsap.context()`: selectors scoped to the page, everything auto-reverted on unmount, re-run on breakpoint change and Tweak replays |

Components: `<PageOutlet/>`, `<Shared id>` (mark FLIP elements — id must be
unique per page), `<Img src alt [ratio] [eager]/>` (lazy, async-decoded,
aspect-ratio reserved, fade-in, plain `<img>` without JS).

Non-hook: `ticker.add(cb)` / `ticker.remove(cb)` — the same RAF loop, raw:
no slow-mo scaling (Lenis rides this one), for code outside React.

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

### URL state (the query)

UI state that belongs in the URL — an open overlay, a selected tab, a preset —
lives in the query, not in a route. Writing is a **shallow** history update: the
router does not re-resolve the entry or remount the page, so the page keeps its
scroll, its canvases and its WebGL context while the address bar changes.

```tsx
const [company, setCompany] = useSearchParam('company')
setCompany('aero')                        // pushState — Back closes the overlay
setCompany(null)                          // remove the param
setCompany('layer', { replace: true })    // no new history entry

const { tab, preset = 'magazine' } = useSearchParams()  // every param, same reactivity
setSearchParam('tab', 'team')                           // the same write, outside React
readSearchParams().tab                                  // the same read, outside React
```

`useSearchParams()` returns a plain object, **not** a `URLSearchParams` — so
`query.preset`, not `query.get('preset')`, which is where it differs from the
same-named hook in React Router and Next. Absent keys read `undefined`. A
repeated key keeps the first value (`?tag=a&tag=b` → `tag: 'a'`); when you want
all of them, that is one line of platform:
`new URLSearchParams(location.search).getAll('tag')`.

**The query is client state.** It is never part of the SSR'd HTML: both hooks
read empty on the server *and through the hydrating render*, which is what keeps
a deep link from mismatching and keeps a page cacheable regardless of its query.
So a deep-linked value arrives one render **after** hydration — react to it in an
effect, and never seed `useState` from it, or you capture the server's empty
value and keep it forever:

```tsx
const { preset } = useSearchParams()
useEffect(() => { if (preset) apply(PRESETS[preset]) }, [preset])   // ✅
const [u] = useState(() => PRESETS[preset ?? 'magazine'])           // ❌ always the default
```

`useRoute().path` is the pathname only, and `RouteInfo` carries **no** `query`
on purpose. `RouteInfo` is also what a transition, an intro and an enhancer
receive, and those run at a *moment* rather than across renders: a query copied
onto the route would look authoritative and be wrong the instant an overlay
opened, while a live one read there would change with no re-render. Read the
query with `useSearchParams()` in render and `readSearchParams()` outside it.

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
    // A shared id is a VALUE, so the same one can sit on more than one
    // surface and more pairs can match than the reader touched. Each pair
    // carries `withinTrigger` — the outgoing element is inside the clicked
    // element — and the list is sorted with those first. It is false for
    // every pair when there is no trigger (popstate, programmatic navigate),
    // so test it rather than assuming it partitions the set.
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

`shared` rects are honest even for targets positioned by scroll-driven motion
(a pinned rail, a scrubbed transform): before measuring, the router runs
`onPrepare` callbacks with the incoming page at its final scroll, and
`@modulato/gsap` uses that moment to build the page's pending motions early.
`onPrepare(fn)` is exported for motion layers that need the same hook — sites
using `useMotion` get it without doing anything.

### Finding the code behind a node

In dev, every host element carries the file and line that authored it:

```html
<h1 class="home__claim" data-modulato-source="/pages/home/page.tsx:78">
```

Inspect a node and you know where it came from — no grepping for a class name.
Useful in devtools, and more so for an agent reading a page, which otherwise
has to guess which component rendered what. It is in the SSR HTML too, so it is
there before hydration.

Dev only: a production build compiles to a different JSX runtime and ships none
of it. Turn it off with `modulato({ sourceAttribute: false })` if it makes
snapshot diffs noisy. Host elements only — a component sees no extra prop.

With `@modulato/tweak` installed, **hold Option (Alt) and click** any element to
open that exact line in your editor. Holding the key outlines whatever is under
the cursor and names it, so you can see what you are about to open; the click is
swallowed, so the site's own handlers and the browser's Option-click behaviour
never fire. Release the key, press Escape, or leave the window to disarm.

If nothing opens, the note that appears says why — the usual causes are an
editor Vite cannot detect (set `$EDITOR`) or a file that no longer exists.

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
- Override keys are reserved at **every** nesting level: write the block next
  to the group it modifies, as above. A hoisted spelling
  (`intro: { phone: { headline: {…} } }`) resolves — and folds into the same
  overlay tabs — identically, but colocated is the house style. Write the same
  leaf BOTH ways and the hoisted one wins: the colocated block merges while
  the resolver descends, the hoisted one merges at the outer level afterwards,
  so it lands last. The Tweak overlay dims the row that is never read.
- **Tweak Mode** (dev, with `@modulato/tweak` installed): the ✦ Tweak
  overlay is tabbed — **Motion**, **Typography** (§7b, when the project has a
  `type.ts`) and **Colors** (a read-only list of the `:root` custom properties,
  since colors are a stylesheet rather than a token module). Motion shows the
  token files for the current view (shell + this page +
  transitions touching this route; "Show all" reveals the rest) — edit live,
  replay Intro/Shell/Motions, loop, 0.1x–1x slow-mo (GSAP, WAAPI, and
  `useTicker` loops all follow), preview any breakpoint + reduced motion.
  Breakpoint/`reduced` override blocks appear as icon tabs on each token
  group; a tweaked row is dotted (click the dot to undo just that edit).
  **Save** writes only the changed values back into `motion.ts` with an
  AST-preserving edit (comments and formatting survive). The same panel edits
  the type system — see §7b.
- **Give each group its search terms.** A group is named for what it IS in the
  code and people search the overlay for what it DOES on the page — "main
  description" is the chapter lede at `flight.enter.lede`, and no substring of
  that path reaches it. Export a `keywords` map beside the default and the
  overlay indexes it without ever rendering it:

  ```ts
  export default motion({ /* … */ })

  export const keywords: Record<string, string[]> = {
    'flight.enter.lede': ['main description', 'subtitle'],
    'track': ['horizontal scroll', 'sideways', 'pinned rail'],
  }
  ```

  Write them when you author a group — three to six plain-English phrases for
  what the reader would see change — and update them when you rename or
  repurpose one. `modulato check` warns when an entry names no group, which is
  what a rename leaves behind. A separate export, not a key inside `motion({…})`:
  the token tree is numbers-and-eases and goes straight to animation code, so a
  `keywords` key would become a row in the panel and widen the resolved type.
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

### Custom easing curves

**A custom ease goes in `modulato.config.ts` under `eases` — nowhere else.**
Declare the curve once as a `cubic-bezier()` string; it becomes available to
every `motion.ts` in the project and appears in the Tweak overlay's ease
dropdown under your name.

```ts
// modulato.config.ts
export default defineConfig({
  eases: {
    swoosh: 'cubic-bezier(0.62, 0.05, 0.01, 0.99)',
    settle: 'cubic-bezier(0.34, 1.56, 0.64, 1)',   // y may overshoot
  },
})
```

Then use it in tokens — **the spelling depends on the backend that file
drives**, because the two don't share an ease vocabulary:

```ts
// pages/home/motion.ts — GSAP (intros, useMotion): the NAME
export default motion({
  intro: { cards: { duration: 0.9, ease: 'swoosh' } },
})

// transitions/home__about.motion.ts — WAAPI: the CURVE
export default motion({
  slide: { duration: 1064, ease: 'cubic-bezier(0.62, 0.05, 0.01, 0.99)' },
})
```

Why: `@modulato/gsap` registers each declared curve with GSAP's CustomEase, so
GSAP resolves `'swoosh'` by name — but transitions run through
`element.animate()`, which **throws** on anything that isn't a CSS easing.
Picking "swoosh" in the Tweak overlay writes the right spelling for the file
you're editing, so you never have to remember which is which.

Note the asymmetry: a GSAP token references the curve by name and follows it
automatically, while a transition token holds a **copy** of the numbers. Retune
a curve in the config and GSAP tokens update themselves; transition tokens keep
the old value until you re-pick the ease (the overlay stops labeling a drifted
value with your name — that's the tell).

Rules — run `npx modulato check` to enforce them (a plain `modulato build` does
NOT run check):

- Values must be literal `cubic-bezier(x1, y1, x2, y2)` strings — they're
  statically extracted for the client, and a single cubic is the one curve
  both backends express exactly. Grab one from cubic-bezier.com.
- `x1`/`x2` must be within 0–1 (CSS rejects otherwise); `y` may overshoot for
  anticipation/overshoot curves.
- Names must not shadow a GSAP built-in — `power0`–`power4`, `quad`, `cubic`,
  `quart`, `quint`, `strong`, `sine`, `expo`, `circ`, `back`, `elastic`,
  `bounce`, `steps`, `rough`, `slow`, `none`, `linear`, with or without
  `.in`/`.out`/`.inOut`, in any casing — registering one would replace GSAP's
  own for the whole page. Avoid CSS easing keywords (`ease-out`) as names too:
  the overlay reads those as CSS-flavored values.
- Springy curves (elastic/bounce) are **not** expressible as a single cubic:
  use GSAP's built-in `elastic.out`/`bounce.out` names in GSAP tokens, and
  keep transitions on a cubic.

## 7b. Typography tokens (`type.ts`)

Type is data, for the same reason motion is: a size or a leading is a number
somebody wants to nudge while looking at the page, so it belongs in a file that
can be read, edited and written back — not spread across stylesheets as
literals.

```ts
// type.ts — at the project root, one per site
import { typography } from 'modulato'

export default typography({
  fonts: { sans: 'ui-sans-serif, system-ui, sans-serif' },

  // The size steps the project uses, and the only ones it uses.
  scale: { xs: 13, sm: 15, base: 18, lg: 24, xl: 34, '2xl': 48, '3xl': 72 },

  styles: {
    headline: {
      font: 'sans', size: '3xl', leading: 1, tracking: -0.03, weight: 600,
      wrap: 'balance',
      phone: { size: 'xl' },          // breakpoint override → a media query
    },
    body: { font: 'sans', size: 'base', leading: 1.7, wrap: 'pretty' },
    label: { font: 'sans', size: 'xs', tracking: 0.08, case: 'uppercase' },
  },
})
```

A style's fields are `font`, `size`, `leading`, `tracking`, `weight`, `case`
(text-transform) and `wrap` (text-wrap). `font` and `size` name a key from the
catalogs above; anything that is not a key is passed through as raw CSS, so a
one-off fluid size can be written in full — `size: 'clamp(3rem, 8vw, 6.5rem)'`
— without inventing a scale step for it. A bare number is px for `size`, em for
`tracking`, and unitless for `leading` and `weight`.

**What Modulato generates.** `type.ts` is rendered to CSS and **inlined into
every SSR response**, so the first painted glyph is already correct — there is
no stylesheet request to wait for and no flash of the browser's default face:

- `:root { --type-font-<name>; --type-size-<step>; --type-<style>-{family,size,leading,tracking,weight,case,wrap} }`
- one class per style: `.type-headline`, `.type-body`, …
- a `@media` block per breakpoint override block, using the query from
  `modulato.config.ts` — CSS is where type is read, so CSS is where the width
  is answered

**Two ways to wear a style.** A class in JSX:

```tsx
<h1 className="type-headline">{title}</h1>
```

…or a mixin in SCSS, which is what the scaffold ships (`styles/typography.scss`)
and what a page stylesheet should use:

```scss
@use '../../styles/typography' as type;

.home__headline { @include type.headline; }
// one step off a style, still inside the system:
.about__title   { @include type.headline; font-size: var(--type-size-2xl); }
```

That file holds no numbers — only `var()` reads — so it cannot drift from
`type.ts`. **Never declare `font-family` or `font-size` in a page stylesheet**;
`modulato check` warns, because a value outside the type system is invisible to
the styleguide, un-editable in Tweak, and missed by the next retypesetting. It
also **errors** on a `--type-…` variable that names no style or scale step,
which is what a rename leaves behind — `var()` falls back silently, so the text
just renders wrong with nothing to say why.

**Type Mode.** In dev, a small round **Aa** button sits beside the ✦ Tweak
launcher: press it and the page itself becomes the control — hover any text for
a badge naming its style, click for a card with the style name, the class
carrying it, the file:line that authored the element, and controls for size,
leading and kerning. Escape closes the card; Escape again leaves the mode. The
panel's **Typography** tab is the other half: the whole system at once, with
the breakpoint tabs a click on a heading cannot reach. Both edit the same
tokens. The button is the ONLY control for the mode — there is deliberately no
second switch in the panel to read it from and forget to update.

Size steps through the `scale` — never a free pixel slider. That is the point
of a closed scale: a site with six sizes reads as a system, and a site with a
free slider ends up with forty-one sizes nobody chose.

Each edit picks a target first, so the preview is what the save will keep:

- **the style** — every element set in it moves;
- **this class** — only elements carrying the selected class, written to
  `overrides` in `type.ts`:

  ```ts
  overrides: { '.home__headline': { style: 'headline', leading: 1.05 } }
  ```

  Overrides are emitted as custom properties **scoped to the selector**, not as
  font declarations, so they win wherever the element's own `font-size` came
  from — no specificity fight and nothing to keep in stylesheet order.

Font stacks are shown but **not editable** in the overlay. A stack is a
comma-separated list of quoted family names, and a free-text box over one turns
a stray character into a site that silently falls back to Times — no error, no
red, just the wrong face everywhere. Changing a typeface is a decision made once
in `type.ts`, next to the `@font-face` or webfont link it depends on. Every field
that is a KEY into a catalog the file declares — a style's `size` naming a scale
step, its `font` naming a stack — is a select rather than a text box, as are
`case` and `wrap`: `var(--type-size-lgg)` is not an error, it is a silent
fallback, so a closed set should not be typed.

Save writes `type.ts` through the same AST-preserving endpoint a `motion.ts`
uses, matching the file's own indentation; an editor edit HMR-repaints the
stylesheet without a reload. It's a mode, not a bare click handler, so links
keep working while the tool is installed.

**Given a design to implement, encode it in `type.ts` first.** A new size is a
scale step; a new kind of text is a style. `create-modulato` scaffolds a
`/styleguide` page that renders the styles, the scale and the color variables
from the live values — delete `pages/styleguide/` if you don't want it.

Colors stay CSS custom properties in `styles/tokens.scss`. Only type is tokens
today.

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

**Build-time refresh (optional).** By default the committed snapshot is the source
of truth — `modulato build` uses whatever `.modulato/content.json` was committed.
A CMS-backed site that rebuilds on publish can set `refetchOnBuild: true` in
`modulato.config.ts`: `modulato build` then re-runs the adapter's `pull()` first, so
a deploy-hook rebuild ships current content. A failed pull warns and falls back to
the committed snapshot (an outage never breaks a deploy); `modulato build
--no-content` forces the snapshot, `--refetch` forces a pull even when the flag is
off. Adapter-agnostic — local JSON, a CMS API, a database; the flag only changes
*when* `pull()` runs. (Loaders can also skip the snapshot and `fetch()` live per
request — `load()` may be async — with any secret proxied through a `server.ts`
action, since a client-side `load()` runs in the browser.)

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

### Response headers (the `response` hook)

`<head>` is the document; this is the **response around it**. A `response`
hook in `modulato.config.ts` runs once per SSR request, before the page
renders, and is the only place to set a header or a cookie on a page load —
a security header, a first-visit cookie, a session refresh.

```ts
// modulato.config.ts — server-only, so it may read secrets
export default defineConfig({
  response({ request, headers, cookies }) {
    headers.set('x-content-type-options', 'nosniff')
    headers.set('referrer-policy', 'strict-origin-when-cross-origin')
    if (!cookies.get('visitor'))
      cookies.set('visitor', crypto.randomUUID(), { path: '/', maxAge: 31536000 })
  },
})
```

It runs for 404s too, and cannot see the matched route — it is a hook on the
request, not on the page. A cookie it sets is **not** visible to that same
request's `load()`: the browser has it from the next request onward. It may be
`async`. Same `cookies` API as server actions (§10).

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

### The request and cookies

A handler gets `request` (the whole `Request` — headers, method, url) and
`cookies`, which is what makes a session possible: sign-in is an action that
verifies a password and sets an httpOnly cookie.

```ts
// pages/account/server.ts
import { action } from 'modulato'

export const signIn = action(async ({ form, cookies }) => {
  const token = await verify(String(form.get('email')), String(form.get('password')))
  cookies.set('session', token, {
    httpOnly: true,               // invisible to document.cookie
    secure: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,     // SECONDS, the header's own unit
  })
  return { redirect: '/dashboard' }
})

export const signOut = action(async ({ cookies }) => {
  cookies.delete('session')       // path/domain must match how it was set
  return { redirect: '/' }
})

export const whoami = action(async ({ cookies, request }) => ({
  user: await session(cookies.get('session')),
  agent: request.headers.get('user-agent'),
}))
```

- `cookies.get` / `getAll` / `set` / `delete`. Writes are collected and flushed
  onto the response when the handler returns — including when it **throws**, so
  an action that clears a session and then rejects still clears it.
- A `get` after a `set` returns the new value; the jar is the request's cookies
  with your writes applied over them.
- `path` defaults to `/`. Without that a cookie set by an action would be
  scoped to `/__modulato/action/…` and invisible to every page.
- `form` is the request body already parsed. `request` still has its body
  unread if you want it another way.

`load()` cannot set a cookie — it also runs in the browser (§3). Setting
belongs in an action or the `response` hook (§9b); reading, in either.

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

Creating a site is a SEPARATE package (`create-modulato`) — `modulato new`
scaffolds inside an existing site and rejects an empty directory:

```
npm create modulato@latest <dir>      new site (create-modulato; the template
                                        declares engines.node >= 24 and ships
                                        an .nvmrc, because its default `dev`
                                        runs through portless — `npm run
                                        dev:plain` works on older Node)
```

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
misplaced intro.ts, invalid `eases` declarations (§7), and a `config.ts` that
reads `ctx.request` without guarding for the client (§3).

## 13. MCP (agents)

```sh
claude mcp add modulato -- npx -y @modulato/mcp     # run from the site root
```

The package is **`@modulato/mcp`**; `modulato-mcp` is the bin it provides, so
naming that alone only resolves if the package is already installed locally.

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

The SSR function runs on **the Node major that ran the build**, so a project
on Node 24 does not deploy onto 22. Pin it, or add your own routes and
functions, through the plugin:

```ts
// vite.config.ts
modulato({
  vercel: {
    runtime: 'nodejs24.x',                          // default: the build's major
    routes: [{ src: '/api/(.*)', dest: '/api' }],   // merged before the SSR catch-all
  },
})
```

`routes` land after the asset cache headers and before `handle: filesystem` —
the only window where your own function can win a path. Modulato removes only
what it owns (`static/`, `functions/__ssr.func`, `config.json`), so a function
your build writes to `.vercel/output/functions/` survives whichever step ran
first.

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
- **Where the server actually is.** A server action (§10) and the `response`
  hook (§9b) run only on the server, get the request, and can set cookies —
  that is where sessions and secrets live. `load()` runs in BOTH places, so it
  gets a read-only `request` that is `undefined` on client navigations and can
  never hold a secret. Page components render in both too. If a value must
  stay on the server, it must never become props.
- Nested scrollable UI under Lenis needs `data-lenis-prevent` on the
  scrollable element.
- Transitions should start their animations synchronously in `run()`.
- After ANY structural edit: `npx modulato check`.
