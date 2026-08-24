# @modulato/server

## 0.3.0

### Minor Changes

- aa9b2bb: Typography as tokens: `type.ts`, generated CSS, and Type Mode in the overlay

  A site's type system now lives in a `type.ts` at the project root, as data —
  font stacks, a closed size scale, and the named styles built from them, with
  breakpoint override blocks spelled exactly as a `motion.ts`'s. The same
  argument as motion tokens, applied to type: a size or a leading is a number
  somebody wants to nudge while looking at the page, so it belongs somewhere it
  can be read, edited and written back.

  - **`typography({...})`** (from `modulato`) plus `typeCss()`, which renders the
    module to `:root` custom properties, one `.type-<name>` utility class per
    style, and a `@media` block per breakpoint override. `@modulato/server`
    **inlines it into every SSR response**, so the first painted glyph is already
    correct — no stylesheet round trip, no flash of the default face.
  - **Type Mode** in the Tweak overlay: a Typography card that edits the whole
    system (breakpoint tabs included), and a _Click text_ toggle that turns the
    page into the control — hover any text for a `Tt` badge naming its style,
    click for a card with the style, the class carrying it, the file:line that
    authored the element, and controls for size, leading and kerning. Size steps
    through the project's scale rather than offering a free pixel slider. Each
    edit picks its target first — the style, or just the clicked class (written
    to `overrides`, emitted as custom properties scoped to the selector, so no
    specificity fight can decide it differently).
  - **The writeback learned `type.ts`**, so the overlay, `modulato tokens` and
    `@modulato/mcp` all reach it through the path a `motion.ts` already used. It
    can now also create a key that isn't in the file yet (a per-selector
    override), and it **matches the file's own indentation** — recast defaults to
    four spaces, which reprinted a two-space file's whole object and turned one
    saved slider into a 150-line diff.
  - **`modulato check`** errors on a `--type-…` variable naming no style or scale
    step (what a rename leaves behind — `var()` falls back silently, so the text
    just renders wrong), and warns when a page stylesheet declares `font-family`
    or `font-size` directly.
  - **`create-modulato`** scaffolds `type.ts`, a numbers-free
    `styles/typography.scss`, and a `/styleguide` page rendering the styles, the
    scale and the color variables from the live values — deletable in one folder.

  Type Mode is also reachable without the panel: a round **Aa** button beside the
  ✦ Tweak launcher arms it in one press, and fills in while it is on. Font stacks
  are shown but not editable in the overlay — a stray character in one silently
  falls the whole site back to Times, and a typeface is a decision made once in
  `type.ts`, next to the webfont link it depends on.

  The overlay is now tabbed — **Motion**, **Typography** and **Colors** — rather
  than one scroll holding all three. Colors is read-only: colors are CSS custom
  properties in a stylesheet, not a token module, so there is nothing to write
  back to; it lists the `:root` palette and copies a `var()` on click.

  **Escape** backs out one step at a time — the type card, then Type Mode, then
  the panel — and blurs a focused panel field before any of that.

### Patch Changes

- Updated dependencies [aa9b2bb]
  - modulato@0.9.0

## 0.2.0

### Minor Changes

- c6d364d: Give the server the request: cookie auth is now possible.

  Nothing on the server could see the request. SSR was `handle(url)` — a URL
  string, no headers — and an action got `{ form }` only, so it could neither
  read a cookie nor set one. Any site with a session had to resolve every
  authenticated view client-side after mount, a round trip and a skeleton each.

  Three additions, smallest surface first:

  - **Actions get `request` and `cookies`.** `action(async ({ form, request, cookies }) => …)`
    with `cookies.get/getAll/set/delete`. Writes flush onto the response when
    the handler returns, including when it **throws** — an action that clears a
    session and then rejects still clears it. `path` defaults to `/`, without
    which a cookie set by an action would be scoped to `/__modulato/action/…`
    and invisible to every page. This alone unblocks sign-in.
  - **`load()` gets `ctx.request` — server-only.** Present on the first paint,
    `undefined` on client navigations, because `load()` runs in both places.
    `modulato check` now ERRORS on a `load()` that reads it without a guard:
    unguarded it throws on the first link click and not before, which is the one
    order nobody tests in.
  - **A `response` hook in `modulato.config.ts`.** Runs once per SSR request
    before the page renders — the only place to set a response header or a
    cookie on a page load. Applied identically by the dev middleware and the
    Vercel function.

  `handle(url)` still works; `render()` now also returns `headers`, which
  callers must apply (`applyHeaders`). `@modulato/server` exports `nodeRequest`,
  `requestUrl`, `requestHeaders`, `applyHeaders`, `createCookies`,
  `parseCookieHeader` and `serializeCookie`.

### Patch Changes

- Updated dependencies [c6d364d]
  - modulato@0.8.0

## 0.1.3

### Patch Changes

- 3a57bca: Widen the `modulato` dependency range to any 0.x (`>=0.1.0 <1.0.0`) so a core
  **minor** release no longer forces these packages to a major version bump. Core
  and the framework packages version together on the 0.x line; the range next needs
  revisiting when core reaches 1.0.
- Updated dependencies [9b927a0]
- Updated dependencies [acd438d]
- Updated dependencies [8a1bd2a]
  - modulato@0.2.0
