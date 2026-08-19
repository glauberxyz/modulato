---
'@modulato/tweak': minor
'@modulato/vite': minor
---

Inspect mode: hold Option (Alt) and click any element to open the line that authored it.

Reads the `data-modulato-source` attribute the Vite plugin stamps in dev, so it names the
real file, line and column rather than guessing from a class name. Holding the key outlines
whatever is under the cursor and labels it, so you can see what you are about to open; the
click is swallowed, so neither the site's handlers nor the browser's own Option-click
behaviour fire.

Resolution goes through a new `GET /__modulato/open`, because Vite's `/__open-in-editor`
resolves relative paths against `process.cwd()` — rarely the Vite root in a monorepo — and
answers 200 even when the file does not exist. The endpoint resolves against the real root,
refuses paths that escape it, and turns a miss into a message instead of nothing happening.
