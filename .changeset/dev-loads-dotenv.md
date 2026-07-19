---
"modulato": patch
---

`modulato dev` now loads `.env` / `.env.local` into `process.env` at startup, so a
server-side `load()` (SSR on first paint) sees the same variables a credentialed
content adapter does — Vite only exposes dotenv via `import.meta.env`, not
`process.env`. This is the dev-runtime sibling of the same fix for `modulato content`:
a loader that reads `process.env.MY_API_URL` on the server now resolves under
`modulato dev` without a `vite.config` shim. Precedence unchanged — a variable already
in the real environment wins, and `.env.local` overrides `.env`.
