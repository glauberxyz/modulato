# @modulato/server

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
