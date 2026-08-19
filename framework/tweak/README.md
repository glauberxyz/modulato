# @modulato/tweak

Tweak Mode for Modulato (dev only): a floating overlay listing every motion
token on the page — edit live, replay intros/motions, loop, slow-mo, preview
breakpoints — and Save writes values back into `motion.ts` with an
AST-preserving edit.

It also adds **inspect mode**: hold Option (Alt) and click any element to open
the line that authored it in your editor. That reads the `data-modulato-source`
attribute `@modulato/vite` stamps in dev, so it names the real file, line and
column rather than guessing from a class name.

Install it and the dev server picks it up automatically. Part of
[modulato](https://www.npmjs.com/package/modulato).
