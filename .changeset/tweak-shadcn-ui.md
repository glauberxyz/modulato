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
