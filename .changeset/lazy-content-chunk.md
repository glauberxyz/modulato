---
'modulato': minor
'@modulato/vite': minor
---

The content snapshot is fetched on the first client navigation instead of
shipping in the entry bundle.

`virtual:modulato/content` was imported eagerly by the generated client entry,
so the whole snapshot sat in the one chunk every route loads before anything
else — every visitor downloaded every route's content to see one page. It is
not needed then: the first page hydrates from props SSR already sent, and
`resolveEntry` only touches the snapshot when it has to RUN a route's `load()`,
which happens on client navigations and never on first paint.

`boot({ content })` and `<Root content>` now accept a `ContentSource` — the
snapshot object as before, or a function returning it. `@modulato/vite` passes
a dynamic import, so the snapshot becomes its own chunk: absent from the entry,
not preloaded, fetched on the first link click and memoised for every
navigation after. The server entry keeps its eager import, where there is no
download to pay for.

In the demo this moves 21 KB out of a 313 KB entry chunk. The saving scales
with the content, not the code — a site with a few hundred entries is where it
stops being cosmetic.

Passing a plain object still works, so existing `boot()` calls are unaffected.
