---
'@modulato/vite': patch
---

Dev no longer 404s a request whose `Accept` is not HTML.

`curl http://localhost:5173/` returned `Cannot GET /` in dev and 200 in
production — same URL, same build, opposite answers. The SSR middleware gated
on `Accept: text/html`, and `*/*` is what curl, wget, health checks, uptime
monitors and most shell scripts send, so the first thing anyone does to check
a dev server looked like a broken route.

It now matches the request PATH instead — asset-shaped paths (`/@vite/`,
`/@fs/`, `/@id/`, `/node_modules/`, an extension on the last segment) fall
through to Vite's own middleware, everything else is served as a page. An
explicit `text/html` still wins, so a real route with a dot in its last
segment (`/blog/v1.2-release`) is served while a missing `/logo.png` keeps
getting Vite's asset 404 rather than a page with a 200.
