---
"modulato": patch
---

Build-time content refresh (`refetchOnBuild`). Opt in with `refetchOnBuild: true`
in `modulato.config.ts` to re-run the content adapter's `pull()` at the start of
`modulato build`, so a deploy ships freshly pulled content instead of the committed
snapshot — the loop a CMS-backed site wants (publish → deploy hook → rebuild → fresh
content). Off by default, so existing builds stay reproducible and credential-free.
A pull failure at build warns and falls back to the committed snapshot;
`modulato build --no-content` forces the snapshot and `--refetch` forces a pull even
when the flag is off. Works with any adapter (local JSON, a CMS API, a database) —
it just changes *when* `pull()` runs.
