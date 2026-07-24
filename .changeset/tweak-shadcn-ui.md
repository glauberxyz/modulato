---
'@modulato/tweak': minor
---

Redesigned overlay UI on shadcn primitives in a Shadow DOM with precompiled
CSS — a polished look with zero styling requirements on the host site (no
Tailwind at runtime, host styles can't bleed in or out). The theme is
deliberately brand-agnostic: white + shades of gray + black, light-only, all
Inter (bundled), pill-shaped controls — the overlay lives inside other
people's designs, so it carries none of its own.

- Named sections: **Replay** (Intro / Shell / Motions play buttons + a Loop
  switch), **Preview as** (Auto/breakpoint/reduced icons in the header, a
  segmented 0.1x–1x speed control), **Tokens**.
- Tokens group by parent path under a two-tone header (`shell › menu`), and
  breakpoint/`reduced` override blocks fold into per-group **icon tabs**
  (desktop = base values, phone/tablet, circle-dot-dashed = reduced) instead
  of stacking as separate groups. A non-active tab with unsaved edits carries
  a dot — pending changes are never invisible.
- Condensed rows: a number is a filled-track slider with its label inside plus
  a fixed-width value box; eases, strings, and booleans are label-inside
  pills. A tweaked row shows a dot on the right that doubles as its per-row
  reset, so a stray drag is visible and individually undoable.
- Ease fields are a dropdown of the full GSAP catalog, and flavor-aware:
  transition motion files hold CSS/WAAPI easings (offering GSAP names there
  broke the transition — invalid easing → element.animate throws), so
  CSS-flavored fields get the easings.net curve set as labeled cubic-beziers
  while GSAP fields keep the name catalog. Unknown values (project
  CustomEase) are preserved as their own option.
- Each motion file is a white rounded card on the panel's gray well, with
  per-file Save (N) / Reset and a copy-path button. The filter box (search
  icon, dirty rows exempt) narrows every card; the token list stays scoped to
  the current view with "Show all (+N)"; the launcher pill is now "✦ Tweak".

The overlay bundles Inter (variable latin subset, ~48KB woff2, OFL, dev-only)
under the private family name 'Inter Tweak', injected into the document head
(shadow-tree font faces don't load in Chromium) — guaranteed Inter without
ever shadowing a host site's own Inter faces.
