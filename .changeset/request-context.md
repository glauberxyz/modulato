---
'modulato': minor
'@modulato/server': minor
'@modulato/vite': minor
---

Give the server the request: cookie auth is now possible.

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
