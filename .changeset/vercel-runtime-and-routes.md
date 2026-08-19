---
'@modulato/vite': minor
---

Vercel output: runtime follows the build, and the build output is extensible.

- The SSR function was hardcoded to `nodejs22.x`, so a project on Node 24
  silently deployed onto 22. It now uses **the Node major that ran the
  build**, and an unknown major clamps to the newest runtime this version
  knows about with a warning rather than shipping a string Vercel rejects.
- `emitVercelOutput()` wiped `.vercel/output` entirely and wrote one fixed
  route table, so a project needing its own function had to read the generated
  JSON back and splice a route into it. Modulato now removes only what it owns
  (`static/`, `functions/__ssr.func`, `config.json`), leaving any other
  function in place.

Both are configurable: `modulato({ vercel: { runtime, routes } })`. Caller
routes merge after the asset cache headers and before `handle: filesystem` —
the only window where a project's own function can win a path. `vercel: true`
still works.
