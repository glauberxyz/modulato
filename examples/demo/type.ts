import { typography } from 'modulato'

/**
 * The type system — every text style on this site, as DATA.
 *
 * Two faces and a closed set of steps. Franklin Gothic sets the titles and the
 * small copy; Adobe Garamond sets every line of prose. Both are loaded from
 * Typekit in modulato.config.ts `head.link` and named here, so the stack is
 * written once.
 *
 * Modulato renders this into CSS custom properties (`--type-title-size` and
 * friends) plus one `.type-<name>` class per style, and inlines the result into
 * every SSR response — so the first paint is already typeset. styles/
 * typography.scss is the SCSS spelling of the same thing: mixins that read the
 * variables, holding no numbers of their own.
 *
 * `text-wrap: balance` on nearly everything is deliberate. Browsers cap
 * balancing at a few lines and fall back on long prose, so it is a setting for
 * headings and short blocks that costs paragraphs nothing — and declaring it in
 * the type system rather than leaning on inheritance means a style keeps its
 * wrapping wherever it is used, including inside anything that sets
 * `text-wrap` for its own reasons.
 */
export default typography({
  fonts: {
    sans: "'franklin-gothic-urw', 'Helvetica Neue', sans-serif",
    serif: "'adobe-garamond-pro', Georgia, serif",
  },

  // The viewport range the fluid steps below cross: phone to laptop. One
  // range for the whole scale, so the steps stay in proportion to each other
  // at every width — which is the thing a hand-written `clamp()` per step
  // cannot promise, since each one encodes a range nobody wrote down.
  fluid: { from: 390, to: 1440 },

  // The sizes this site uses, and the only ones it uses. Numbers are px as
  // drawn; the framework ships them in rem so a reader's font-size setting
  // reaches them. A fluid step is its two ends, and Modulato solves the line
  // between them — `{ min: 44, max: 90 }` is 44px at 390 and 90px at 1440.
  scale: {
    xxs: 12,
    xs: 14,
    sm: 22,
    base: 24,
    lg: 30,
    xl: 40,
    sub: { min: 24, max: 32 },
    plate: { min: 24, max: 34 },
    // Full size by 1000px and flat above it — a chapter opener is meant to be
    // the same 90px on a laptop as on a large display, so it finishes growing
    // where the column stops widening. Its own range, stated, because that is
    // a decision about this step rather than about the scale.
    display: { min: 44, max: 90, to: 1000 },
    statement: { min: 40, max: 190 },
  },

  styles: {
    // Franklin Gothic, heavy. Chapter titles, numerals, pull quotes.
    title: {
      font: 'sans',
      size: 'xl',
      weight: 900,
      leading: 0.95,
      tracking: -0.03,
      wrap: 'balance',
    },

    // The Title style at display scale — chapter openers and the index claim.
    // Not a separate face or weight: the same style, sized fluidly.
    display: {
      font: 'sans',
      size: 'display',
      weight: 900,
      leading: 0.95,
      tracking: -0.03,
      wrap: 'balance',
    },

    // Section headings inside a chapter — a Title at reading scale.
    subhead: {
      font: 'sans',
      size: 'sub',
      weight: 900,
      leading: 0.95,
      tracking: -0.03,
      wrap: 'balance',
    },

    // A plate's title. Its own step, and not `subhead`, because these are
    // often whole sentences and want to break a little later.
    'plate-title': {
      font: 'sans',
      size: 'plate',
      weight: 900,
      leading: 0.95,
      tracking: -0.03,
      wrap: 'balance',
    },

    // The statement heading — one line filling the fold. Statement.tsx
    // MEASURES the size against the rendered line boxes and sets it inline, so
    // the size below is the fallback for the frame before that runs, and for no
    // JS at all: the heading is never unstyled, only less exact.
    //
    // The leading and tracking are not fallbacks — they are the real values,
    // and they sit well below the Title style's because at this size the
    // leading is the gap between three heavy lines rather than the rhythm of a
    // paragraph. Every 1% here is roughly 10px of block height at a laptop
    // width, which is exactly the kind of number that wants a slider.
    statement: {
      font: 'sans',
      size: 'statement',
      weight: 900,
      leading: 0.786,
      tracking: -0.04,
      wrap: 'balance',
    },

    // Adobe Garamond. All prose. The measure does the work a second size would.
    body: {
      font: 'serif',
      size: 'base',
      weight: 400,
      leading: 1.32,
      tracking: -0.01,
      wrap: 'balance',
      // One step down on anything that is not a large screen. Two blocks
      // rather than one, because the config's `tablet` runs 768–1279px and
      // `phone` sits below it: together they are "not a large screen", and
      // spelling both out is what makes that legible in the file.
      tablet: { size: 'sm' },
      phone: { size: 'sm' },
    },

    // Garamond, larger. Ledes and opening paragraphs — the step between a
    // title and running prose. Tighter leading, since the lines are longer.
    'body-large': {
      font: 'serif',
      size: 'lg',
      weight: 400,
      leading: 1.2,
      tracking: -0.01,
      wrap: 'balance',
    },

    // Franklin Gothic, regular. Captions, figure refs, running heads,
    // metadata, footnotes, nav — the layer that does most of the editorial
    // work.
    small: {
      font: 'sans',
      size: 'xs',
      weight: 400,
      leading: 1.5,
      tracking: 0,
      wrap: 'balance',
    },

    // Small uppercase copy — labels and running heads only. Set solid: the
    // caps carry the distinction on their own, and tracking them out turned
    // every label into a texture you read letter by letter.
    label: {
      font: 'sans',
      size: 'xs',
      weight: 400,
      leading: 1.5,
      tracking: 0,
      case: 'uppercase',
      wrap: 'balance',
    },

    // Diagram readouts and clamp expressions — the smallest thing on the site.
    readout: {
      font: 'sans',
      size: 'xxs',
      weight: 400,
      leading: 1.5,
      tracking: 0,
    },
  },

  // Type Mode's "save to this class" adds an `overrides` block here — one
  // selector departing from its style:
  //
  //   overrides: { '.styles__title': { style: 'display', size: 'plate' } }
  //
  // They are emitted as custom properties SCOPED to the selector, so they win
  // wherever the element's own font declarations came from — no specificity
  // fight, and nothing to keep in stylesheet order.
})
