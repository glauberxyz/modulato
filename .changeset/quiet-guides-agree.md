---
'modulato': minor
'create-modulato': minor
---

The styleguide is a framework page: `modulato/styleguide`

`create-modulato` has scaffolded a `/styleguide` page since typography tokens
landed, and it was 200 lines of project-owned JSX and SCSS styled with the
site's own type mixins and colour variables. That made it a page of the site
as far as any agent was concerned, and every agent that implemented a design
re-skinned it along with the rest of `pages/` — starting by rewriting
`color.ts`, at which point the page's `var(--rule)` named nothing, it looked
broken, and "fix it" meant "redesign it". Two projects, two layouts. The demo
had a third.

The markup and the chrome now ship with the framework, from a new
`modulato/styleguide` export, and the scaffolded page is one component call:

```tsx
import { Styleguide } from 'modulato/styleguide'
import type from '../../type'
import colors from '../../color'
import motion from '../../motion'

export default () => <Styleguide type={type} colors={colors} motion={{ shell: motion }} />
```

The look is Modulato's and not the project's — a white page, shades of gray,
the same bundled Inter the Tweak overlay renders in, every length in px so a
site's root font size cannot scale it — and it is the same in every project.
It is light DOM rather than a shadow root, because the specimens exist to
render through the document's `.type-*` rules, variables, media queries and
loaded fonts, none of which cross a shadow boundary; the stylesheet defends
itself the way an embedded widget does instead.

What it shows, all read and never restated: the type styles (the authored
fields on one line, breakpoint blocks and the fluid range included, each named
by its `--type-<style>-size` variable), the palette, the motion tokens of
whichever modules the page hands over, the declared eases as drawn curves, and
the breakpoints. The side nav marks the section being read.

There is deliberately no table of the `scale` steps and no list of the `fonts`
stacks: a step is the size of some style already, a stack is the face some
style is set in, and both are on show in the specimens. A second table of the
same facts is a second place to read one thing.

The type specimens are set the way a foundry sets one: the **same paragraph**
for every style in a box of one height, clamped with an ellipsis, so a big
style fills it in two lines and a small one in a dozen — the amount you can
read IS the size, and the leading, the line breaks and the wrapping are on
show rather than described. The sheet deliberately says **nothing about what a
style is for**: where a style gets used is the project's decision, and an
agent inventing that copy is how a specimen sheet turns into volumes of text
nobody asked for.

`Section` from the same module adds a project's own sections in the same
chrome, listed in the side nav automatically. Delete `pages/styleguide/` and
the Menu entry to opt out, as before.

The site's shell steps aside on the page. The sheet's root carries
`data-modulato-styleguide`, and the scaffolded `styles/global.scss` hides the
menu on it with `body:has([data-modulato-styleguide]) .menu { display: none }`
— CSS rather than a route check in the shell component, so it is already true
in the SSR HTML and the project keeps the last word about its own shell. The
sheet carries a "Back to site" link of its own.

`viewportStore.breakpoints()` is new — the configured map, for a client that
wants to print it.
