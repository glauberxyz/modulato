---
'@modulato/tweak': minor
---

Redesigned overlay UI on shadcn (base-luma preset), mounted in a Shadow DOM
with precompiled CSS — the polished look with zero styling requirements on the
host site (no Tailwind at runtime, host styles can't bleed in or out).

- Named sections: **replay** (intro / shell / motions + loop), **preview as**
  (breakpoint + reduced + speed — one logical chain: what plays, as which
  breakpoint, at what speed), **tokens**.
- Tokens grouped by parent path (`shell › menu › phone` reads once as a header;
  rows show just the leaf name) instead of repeating dotted paths per row.
- Ease fields are now a dropdown of the full GSAP catalog (none + power1–4 /
  sine / expo / circ / back / elastic / bounce × in/out/inOut); an unknown
  value (project CustomEase) is preserved as its own option.
- Filter box got a clear button; dirty rows keep their ● accent + per-row ↺.

- Breakpoint pills use icons (phone / tablet / desktop, inlined lucide shapes)
  with the name as tooltip + aria-label; unknown breakpoint names keep text.

- Fix: ease dropdowns are now flavor-aware. Transition motion files hold CSS/WAAPI
  easings (`cubic-bezier(…)`) — offering GSAP names there broke the transition when
  selected (invalid easing → element.animate throws). CSS-flavored fields now get the
  named CSS eases plus the standard curve set as valid cubic-beziers (labeled
  sine/power/expo/circ/back × in/out/inOut); GSAP fields keep the name catalog.

- The overlay renders entirely in Inter (sans, headings, and the former mono
  spots). The variable latin subset ships with the package (~48KB woff2, OFL,
  dev-only) under the private family name 'Inter Tweak', injected into the
  document head (shadow-tree font faces don't load in Chromium) — guaranteed
  Inter without ever shadowing a host site's own Inter faces.
