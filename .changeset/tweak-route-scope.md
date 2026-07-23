---
'@modulato/tweak': minor
---

The token panel now scopes to the current view instead of listing every motion
file loaded this session: shell (`/motion.ts`), the current page's tokens, and
transitions touching the current route (`home__about` shows on both `home` and
`about`; `default` always). A dirty file always stays visible — a pending save
can never be hidden — and a "show all (+N)" toggle reveals the rest without
navigating there. Relevance is derived from the file path + current route, no
core change.
