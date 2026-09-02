---
'modulato': patch
---

`meta()` no longer runs on hydration, where it could not be run correctly

A page whose `meta()` reads the content snapshot — the documented way to build
a title from a CMS — threw on first paint and took the whole page down with
it. The symptom was a fully blank page over perfectly good SSR'd HTML, on
every route, with nothing in the console but a bare `Uncaught (in promise)`.

Two correct decisions met and produced a broken one. The lazy-content change
made `resolveEntry` skip fetching the snapshot when SSR already sent `props`,
so the first page never pays for a fetch it does not need — and it passes `{}`
as `content` to say so. But `meta()` was still called with that empty object,
so `const { title } = content.settings` threw a TypeError. The client entry
chains `boot(...).then(...)` with no `.catch`, so the rejection surfaced with
no message, and because `boot()` never finished, the intro never removed the
`#__modulato { visibility: hidden }` cloak it installs. SSR was unaffected —
there `props` is undefined, the snapshot is real, and `meta()` is fine — which
is why `curl`, `modulato check`, `tsc` and a production build all stayed green.

The fix is to skip `meta()` entirely when `props` was provided. That entry's
meta is the one meta nobody reads: the server already computed it and it is in
the document, and `Entry.meta` is only ever consumed on navigation
(`root.tsx` applies `next.meta.title`), which always resolves with
`props === undefined`. The lazy-content optimization is untouched.

The demo now covers this. Every config in it read only `props` in `meta()`,
which is exactly why the bug shipped — `pages/home/config.ts` reads the
snapshot now, so the demo's first paint exercises the path.
