# HALFTONE — demo content plan

A mini-site that explains the paper-halftone shader running on modulato.org's
homepage: where the technique came from, how it actually works, and how four
centuries of printing rules became ~200 lines of GLSL.

**Why this subject.** The shader is already ours (`docs/site/pages/home/scene.tsx`
— Paper Design's `HalftoneCmyk`, Apache-2.0, over a raymarched scene). Explaining
it means the demo teaches something true instead of animating lorem ipsum, and
every interactive diagram is *the actual production shader* with one uniform
exposed. The framework gets demonstrated by carrying real content.

**Voice.** Editorial, present tense, specific. Short declaratives. Numbers and
names over adjectives. Every historical claim is sourced (footnote list per
chapter); anything the research couldn't corroborate is cut, not hedged.

**Length discipline.** Nobody reads a bible. Target per chapter: ~350–500 words
of body copy, broken into 4–6 movements, each paired with a figure or a
diagram. The scroll should always be *revealing* something, never just moving
text past.

---

## 1. Design system

### Grid — 12 columns, one rule

```
--grid: 12 cols · 20px gutter · 32px margin (phone: 6 cols · 16 · 20)
```

Everything sits on it. The dynamism in the reference spreads comes from
*varying which columns are used*, not from varying type sizes:

| Pattern | Columns | Used for |
|---|---|---|
| Full bleed | 1 / -1 | chapter openers, plate inspectors |
| Wide figure | 2 / 9 | primary historical images |
| Text measure | 7 / 12 | body prose (≈65ch at 24px) |
| Narrow aside | 2 / 5 | captions, footnotes, marginalia |
| Split | 1/6 + 7/12 | figure ↔ explanation pairs |
| Offset stack | 3/8 then 6/11 | the "integrated" overlap look |

Images and text share cells and overlap deliberately — a figure in `2/9` with a
caption hanging in `9/11` at small size, prose starting in `7/12` below it.

### Type — three sizes, already in `styles/`

| Role | Font | Size | Use |
|---|---|---|---|
| **Title** | Franklin Gothic URW 900 | 40px | chapter titles, numerals, pull quotes |
| **Body** | Adobe Garamond Pro | 24px | all prose |
| **Small** | Franklin Gothic URW | 14px | captions, figure labels, metadata, nav, footnotes |

Reading comfort comes from **measure and leading**, not more sizes. Small copy
does a lot of work: `ABB. 3 · S. 94`-style figure refs, running heads, plate
labels, marginal dates — exactly the density in the references.

### Color — two worlds

```
Index / darkroom :  bg #14110f   fg #f4f1ea   (dark, white type)
Chapters         :  bg #f4f1ea   fg #231f20   (off-white, dark type)
Ink accents      :  C #00a0c6  M #d81e78  Y #f5c400  K #231f20
```

The plate colors appear *only* where a plate is being discussed — the site is
monochrome until CMYK becomes the subject, then it earns color.

---

## 2. Route map — three levels

```
/                        Index — dark. What this is + the table of contents.
/press                   I.   The Binary Press
/press/[figure]               → figure inspector (level 3)
/screen                  II.  The Screen
/screen/[figure]
/angles                  III. Four Screens, One Sheet
/angles/[figure]
/gpu                     IV.  The Press on the GPU
/gpu/[figure]
/darkroom                Playground — dark. Every uniform, live.
```

### Transitions (the point of the level structure)

| Pair | Move |
|---|---|
| `index__chapter` | **Plate registration.** The dark index separates into four offset CMYK ghosts that slide apart; the chapter's plates arrive from their four screen angles and land in register. Symmetric — reverses on the way back. |
| `chapter__chapter` | **Paper feed.** Outgoing sheet pulls up out of the press, next sheet rolls in from below with a slight skew that corrects on landing. |
| `chapter__figure` | **FLIP.** `<Shared id="fig:xyz">` morphs the inline figure into the full-bleed inspector. Real layout → real layout. |
| `default.ts` | **Ink bleed wipe** — so every unlisted pair still feels authored. |
| Click-point dots | Every chapter link carries `data-plate`; the transition reads `trigger.dataset.plate` + `getBoundingClientRect()` and floods a dot in that ink from the exact pixel clicked. Four visibly different transitions, one file. |

---

## 3. Chapters

### Index (`/`) — dark

Short. Three movements:

1. **The claim.** "Look closely at any photograph ever printed on paper. There
   is no gray in it." — over the live shader, which is the site's own subject.
2. **The problem, in one paragraph.** A press lays ink or leaves paper bare;
   it has no dial for 40% gray. Everything that follows is one workaround,
   refined for 140 years.
3. **The index itself.** Four chapters as an editorial contents list — roman
   numeral, title, one-line abstract, a plate-colored dot. Plus the origin
   teaser: Talbot 1852 → Ives 1881 → Levy 1893 → the newspaper, 1880.

Interaction: the background shader responds to pointer; scrolling the index
raises `u_size` so the dots coarsen as you descend — the page demonstrates its
own subject before explaining it.

---

### I. `/press` — The Binary Press

**What it covers.** Why halftone had to be invented, and what the world did
instead for fifty years.

- A press is a binary device: one ink film, one density. *(UMN Libraries)*
- Before it: **wood engraving.** End-grain boxwood, non-printing areas cut
  away, locked up beside metal type. Large images = small blocks bolted
  together, so a *team* could carve one picture — Harper's cut illustrations
  into ~2in squares, one carver each, then a "finishing engraver" reconciled
  the seams.
- The cost: an expert engraver spent 10–12 hours on a 5×4in block; a full page
  took a week; a full-page block ran about **$500** — two to four months of a
  skilled engraver's wages, for one picture in one issue. *(flagged
  single-source: Housatonic Museum — present as "one account records")*
- **Chromolithography** was worse: eight to forty stones, one per color, each
  drawn by a specialist "chromist." *(American Antiquarian Society)*
- The real point: **every printed image was a translation by a human hand.**
  Even photographs were printed onto the block and then cut by an engraver,
  whose signature sat next to the artist's.
- The kill shot: "By 1895, most illustrations in books and periodicals were
  halftones or line-blocks." Commercial wood engraving simply ended.

**Figures.** Stradanus *Impressio Librorum* (ca. 1600 printing shop, Met CC0);
*Sculptura in Aes* (engraving workshop, Met CC0).

**Diagram — "Ink or nothing."** A gray slider the reader drags. Above: the
requested continuous gray. Below: what a press can actually deposit — it snaps
to black or white. The gap between the two bars *is* the problem the rest of
the site solves.

---

### II. `/screen` — The Screen

**What it covers.** The invention lineage, told accurately (most popular
accounts get Ives wrong).

- **Talbot, 1852.** British patent no. 565. Proposed interposing "photographic
  screens or veils" — black crape, gauze, muslin — between negative and plate.
  He had the concept thirty years before anyone made it pay.
- **Ives, 1881 — and the correction.** Ives patented the first commercially
  successful method, but **it used no screen**: a swelled-gelatin relief, a
  plaster cast, and an inked rubber grid. He replaced it later with the
  crossline screen he's now remembered for. *(This is the chapter's best
  "actually…" beat.)*
- **The Levy brothers.** Louis (1846–1919) and Max (1857–1926), Philadelphia.
  Glass coated in lacquer, ruled with a diamond point, etched in hydrofluoric
  acid, grooves filled opaque, two plates cemented at right angles. Max Levy's
  US Patent 521,659, filed 1 Mar 1894. The Science Museum holds an 85-line
  Levy screen from 1893.
- **Meisenbach, 1882.** German Reichspatent 22244, 9 May 1882 — *Autotypie*.
  Single-line screens physically **turned during the exposure** to fake a
  crossline. First commercial success with relief halftones in Europe.
- **The newspaper, 4 March 1880.** "A Scene in Shantytown," New York *Daily
  Graphic*, Stephen H. Horgan. Widely cited as the first halftone photograph
  in a newspaper. *(Present with that hedge — the research found competing
  "firsts".)*
- **Screen ruling.** Lines per inch: coarse for newsprint (absorbent paper
  spreads ink; fine dots fill in), fine for coated stock.

**Figures.** Shantytown 1880 (hero); Ives portrait 1905; Meisenbach portrait
1905 + his first 1882 autotype; the 1904 *Half-Tone Process* apparatus plates
(screen holder, Linley's adjustment mechanism, process camera).

**Diagram — "Ruling."** The 1904 manual's own Flatiron Building plates are a
gift: the same photograph printed at **60 / 75 / 85** lines and at **175 / 200
/ 400** lines. Present them as a slider that crossfades between the historical
plates *and* the live shader set to the matching `u_size` — 1904's answer and
ours, side by side. Plus the two tonal ramps (highlights→halftones,
halftones→shadows) showing dots inverting as they join up.

---

### III. `/angles` — Four Screens, One Sheet

**What it covers.** Color, and the geometry that makes it possible. This is
the chapter with the site's best interaction.

- Four plates: cyan, magenta, yellow, black. Each is its own screen.
- **Why K exists.** `K = 1 − max(r,g,b)`. On the neutral axis C, M and Y all
  fall to exactly zero and black carries everything — cheaper ink, sharper
  text, and CMY-only "black" is a muddy brown.
- **Why they're rotated.** A square lattice repeats every 90°, so three inks
  can be at most 30° apart and the fourth *must* take a 15° penalty. Yellow
  takes it — because you can't see yellow's beat. That single sentence
  explains all four magic numbers: **C 15° · M 75° · Y 0° · K 45°**.
- **The rosette is the moiré.** At standard angles the smallest beat is ~1.93
  cells — tuned below the eye's resolution rather than eliminated.

**Diagram A — the angle dial (headline interaction).** Four dials, one per
plate. Presets: `Standard` / `All 45°` / `2° apart` / `Randomize`. Live print
plus a magnified rosette inset and a computed beat-wavelength readout. Set any
pair 2° apart and the beat jumps to ~28.6 cells — the screen erupts into
bands. *The concept failing is the lesson.*

**Diagram B — gray collapses to K.** A color picker. Drag toward neutral and
watch C, M, Y drop to zero live. Then hit "warm the shadows" — the exact
`mix(vec3(0.17,0.13,0.10), white, lum)` line from our own scene — and three
plates light up. Explains a real decision in the shipped site.

---

### IV. `/gpu` — The Press on the GPU

**What it covers.** The translation: every rule above, as GLSL. Code and live
result side by side, scroll-scrubbed so each paragraph highlights its lines.

- The cell grid: `cellsPerSide = mix(400.0, 7.0, pow(u_size, 0.7))` — one
  slider spans newsprint to fine art.
- Rotation per plate = the Levy screens' physical angles, as a `mat2`.
- Coverage → radius → `dist = length(pos − cellCenter)` → `smoothstep`. A dot
  is a distance test.
- **The 3×3 neighbor loop.** Why sample neighbors at all? Because a dot at
  high coverage grows past its own cell. At 1×1 the dots get chopped into
  squares and the image can never reach solid black.
- **The half-radius surprise.** `1 − smoothstep(0, radius, dist)` is a blob,
  not a disc; thresholding at 0.5 crosses at `dist = radius/2`, so the printed
  dot is *half* the radius the code computes.
- **Ink multiplies.** `applyInk` multiplies because ink is subtractive — each
  plate removes light. Additive blending would give you a screen, not a page.

**Diagram — "Kill the neighbor loop."** Radio: 1×1 / 3×3 / 5×5, plus a
coverage slider and a fetch counter (4 / 36 / 100). Crank coverage at 1×1 and
watch dots square off against their cell walls; switch to 3×3 and it heals.

**Credits chapter-end.** The Book of Shaders (Patricio Gonzalez Vivo & Jen
Lowe) — shaping functions, patterns/tiling, random; Inigo Quilez — SDFs and
antialiasing; Stefan Gustavson's WebGL halftone tutorial; Paper Design's
`HalftoneCmyk` (Apache-2.0), which is the shader we actually ship.

---

### `/darkroom` — Playground — dark

Every uniform live: `size`, `contrast`, `softness`, `gridNoise`, `type`
(dots / ink / sharp), per-plate flood + gain, grain. Load your own image or
use the live raymarched scene. Presets: `Newsprint 65lpi`, `Magazine 150lpi`,
`Risograph`, `Blown out`.

Closing beat — the framework tie-in: **every number on this page is a motion
token.** Same values, same file, editable in the dev overlay or by an agent
over MCP. The demo explains its own tweakability.

---

## 4. Verified asset manifest

16 assets, every URL fetched and license-checked (0 rejected).

| Asset | Year | Licence | Where |
|---|---|---|---|
| A Scene in Shantytown (Daily Graphic) | 1880 | PD (pre-1929) | II hero |
| — LOC master TIFF alternate | 1880 | PD | II (backup) |
| Frederic Eugene Ives portrait | 1905 | PD | II |
| Meisenbach portrait + 1882 autotype spread (Rijksmuseum) | ca.1900 | CC0 | II |
| Autotypie 1882 Meisenbach (isolated plate) | 1882 | PD | II |
| Meisenbach portrait (Gebr. Lützel) | 1905 | PD | II |
| Flatiron at 60/75/85 lines | 1904 | PD | II diagram |
| Flatiron at 175/200/400 lines | 1904 | PD | II diagram |
| Graduated tint — highlights→halftones | 1904 | PD | II |
| Graduated tint — halftones→shadows | 1904 | PD | II |
| Portrait: unscreened / 130 / 175 line | 1904 | PD | II |
| Anthony screen-and-plate holder (Fig.13) | 1904 | PD | II |
| Linley screen adjustment + process camera | 1904 | PD | II |
| Plate-making printing frame | 1904 | PD | II |
| Stradanus *Impressio Librorum* (Met) | ca.1600 | CC0 | I |
| Stradanus *Sculptura in Aes* (Met) | ca.1600 | CC0 | I |

All are halftones or engravings — **the imagery is the subject**. Zoom any of
them and you see dots, which makes the figure inspectors (level 3) genuinely
worth visiting.

---

## 5. Framework surface — what each chapter proves

| Feature | Where it shows up |
|---|---|
| Coexisting-page transitions | index↔chapter plate registration; chapter↔chapter paper feed |
| `trigger` (clicked element) | dot floods from the exact click point, in the link's plate color |
| `<Shared>` + `flipShared` | chapter figure → level-3 inspector |
| `transitions/default.ts` | ink-bleed fallback (current demo ships none) |
| Persistent shell | running head + plate-progress marker that survives navigation |
| Intros vs transitions | first-load press-start vs navigation moves |
| `useMotion` | scroll-scrubbed code highlighting in IV; figure reveals |
| `useScroll` / Lenis | index dot-coarsening; parallax figure stacks |
| `useTicker` | the shader itself (motion clock — slow-mo now reaches it) |
| Motion tokens + breakpoints + reduced | every animation number; phone/reduced blocks throughout |
| **Config-declared eases** (new) | one brand curve declared once, used across chapters |
| `useSearchParam` | `/darkroom?preset=newsprint` — shareable shader state |
| Content adapter + typed content | chapters and figures live in `content/*.json` |
| Behaviors | footnote/citation enhancer over prose |
| Server actions | (optional) "email me this preset" |

**Caveat noted from research:** `flipShared` clones the node, and a cloned
`<canvas>` comes back blank — so shared-element morphs must use `<img>`
figures, never the live shader. Plate inspectors FLIP the historical scans;
the shader crossfades instead.

---

## 6. Open questions for Glauber

1. **Scope check.** 4 chapters + index + darkroom + level-3 inspectors is the
   full plan. Trim to 3 chapters if it's too much for a demo?
2. **Color.** Plate colors only where CMYK is the subject — or let the whole
   site use ink accents?
3. **The `/darkroom` playground** — worth building the "load your own image"
   path, or keep it to the live scene + a couple of the historical scans?
