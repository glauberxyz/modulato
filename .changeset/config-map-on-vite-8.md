---
'@modulato/vite': patch
---

Read `breakpoints` and `eases` on Vite 8, where `transformWithEsbuild` is gone

Vite 8 moved to rolldown/oxc: `transformWithEsbuild` is deprecated there and
now requires esbuild to be installed separately, so on a stock Vite 8 install
it throws. The config reader caught that, warned, and returned `null` — and
`null` means "use the framework defaults", so the CLIENT silently shipped
Modulato's default breakpoints while SSR went on reading the project's own
from the config directly. The two disagreed: a project declaring
`phone: '(max-width: 768px)'` got the framework's `767px` in the browser, and
every `phone` block in a token module quietly stopped matching at the width it
was written for.

It picks the transform at runtime now — `transformWithOxc` when the installed
Vite has it, `transformWithEsbuild` otherwise — so all three majors in the peer
range work. `vite` is imported as a namespace because a named import of
`transformWithOxc` would fail to LINK on 6 and 7, which do not export it.

The warning also says what it costs now. "Could not read breakpoints" reads as
harmless; that the client and the server will disagree about them does not.
