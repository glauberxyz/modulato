---
'modulato': patch
---

`modulato content` now loads `.env` and `.env.local` before running the content
adapter. The CLI is a plain Node process (not the Vite dev server), so a
credentialed adapter — Sanity, Contentful, anything reading `process.env` in
`pull()` — previously received `undefined` for vars a developer had put in a
dotenv file. Precedence follows the usual convention: a variable already
exported in the environment wins; among files, `.env.local` overrides `.env`.
