---
'@modulato/vite': minor
---

Stamp `data-modulato-source="/pages/home/page.tsx:12:5"` on every host element in dev.

Dev's JSX runtime is already handed the file, line and column of every element it
creates; React keeps it on the fiber, where only devtools can read it. This copies it
into the DOM, which is where an inspector, the Tweak overlay, and an agent reading a
page are all actually looking — collapsing "read a DOM snapshot, guess which component
rendered that node, grep for a class name" into a read.

It works by pointing a project file's JSX runtime import at a thin wrapper, so it lands
identically in the SSR HTML and in client-rendered updates, and no component can swallow
it by not spreading props. Production compiles to a different JSX runtime, so not a byte
of it ships. Opt out with `modulato({ sourceAttribute: false })`.
