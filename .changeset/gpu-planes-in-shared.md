---
"@modulato/gpu": patch
---

A plane inside a `<Shared>` element now flies with it

`<Shared>` marks whatever element it wraps, and a site's card often wraps the
image box rather than the `<img>`. The stage only took a flight when the shared
element itself was a plane, so with the plane one level down the clone flew a
hidden copy of the image — the morph went invisible. The stage now finds every
live plane inside the shared element, draws its copy inside the clone, and
crossfades to the plane at the same place inside the landing element (or the
only one in it). A copy it does not take is un-hidden, however deep.

When a plane's image cannot be uploaded because it comes from another origin,
the dev warning now names the element and the fix: `crossOrigin="anonymous"` on
the element, or CORS headers on its server.
