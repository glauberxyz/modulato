import { typography } from 'modulato'

/**
 * The type system — every text style in the project, as DATA.
 *
 * Same idea as `motion.ts`, applied to type: a size or a leading is a number
 * somebody will want to nudge while looking at the page, so it lives in a file
 * that can be read, edited and written back — not spread across stylesheets as
 * literals. Modulato turns this into CSS custom properties (`--type-body-size`
 * and friends) and one utility class per style (`.type-body`), inlined into
 * every SSR response so the first paint is already typeset.
 *
 * Two ways to wear a style: `@include type.style('body')` from a page
 * stylesheet (see styles/typography.scss), or `class="type-body"` in JSX.
 * Either way the element is stamped with the style's name, which is what lets
 * the Tweak overlay's Type Mode answer "what am I looking at" when you click
 * a heading in the browser.
 *
 * NEVER declare font-family, font-size, line-height or letter-spacing in a
 * page stylesheet. Add or change a style here, and the whole site follows.
 *
 * Given a design to implement: encode its type scale and its styles HERE
 * first, then build pages out of them.
 */
export default typography({
  // Named font stacks. Add a webfont in modulato.config.ts `head.link`, then
  // name it here — `--type-font-<key>`.
  fonts: {
    sans: 'ui-sans-serif, system-ui, sans-serif',
  },

  // The viewport range a fluid `{ min, max }` step crosses, stated once for
  // the whole scale. Only read by steps written as a pair — a plain number is
  // one size at every width.
  fluid: { from: 390, to: 1440 },

  // The size steps this project uses, and the only ones it uses. A closed set
  // is what keeps a site to a scale instead of to forty-one accidental sizes:
  // Tweak's size control steps THROUGH these rather than offering a free
  // pixel slider.
  //
  // A number is the size in PX AS DESIGNED — write what the design says, 18.
  // Modulato ships it in rem, so a reader who has raised their browser's font
  // size gets larger text without the layout inflating around it. You never
  // write the unit; the framework owns that decision (and layout, in the
  // stylesheets, stays in px for the other half of the same reason).
  //
  // A step that should grow with the viewport is its two ends, and Modulato
  // solves the line between them: `display: { min: 44, max: 90 }` is 44px at
  // 390 and 90px at 1440. Two numbers rather than a `clamp()` string because
  // numbers are what Tweak can put a slider on.
  scale: {
    xs: 13,
    sm: 15,
    base: 18,
    lg: 24,
    xl: 34,
    '2xl': 48,
    '3xl': { min: 48, max: 72 },
  },

  styles: {
    // A style names a font and a size from the catalogs above. A one-off can
    // be written inline instead — `size: { min: 32, max: 56 }`, or raw CSS if
    // it is genuinely something else — without inventing a scale step for it.
    headline: {
      font: 'sans',
      size: '3xl',
      leading: 1,
      tracking: -0.03,
      weight: 600,
      wrap: 'balance',
      // Breakpoint overrides, named exactly as in modulato.config.ts — the
      // same spelling a motion.ts uses. Emitted as a media query, because CSS
      // is where type is read and so CSS is where the width has to be answered.
      phone: { size: 'xl' },
    },
    body: {
      font: 'sans',
      size: 'base',
      leading: 1.7,
      tracking: 0,
      weight: 400,
      wrap: 'pretty',
    },
    small: {
      font: 'sans',
      size: 'sm',
      leading: 1.4,
      tracking: 0,
      weight: 400,
    },
    // Small uppercase copy — section headings, running heads, metadata. A
    // style rather than a `text-transform` somebody adds next to `small`,
    // because it is a decision about the type system and belongs where the
    // rest of them are.
    label: {
      font: 'sans',
      size: 'xs',
      leading: 1.4,
      tracking: 0.08,
      weight: 500,
      case: 'uppercase',
    },
  },

  // Type Mode's "save to this class" adds an `overrides` block here — one
  // selector departing from its style:
  //
  //   overrides: { '.home__headline': { style: 'headline', leading: 1.05 } }
  //
  // They are emitted as custom properties SCOPED to the selector, so they win
  // wherever the element's own font declarations came from — no specificity
  // fight, and nothing to keep in stylesheet order.
  //
  // Left out until there is one: an empty literal is a key recast has to patch
  // INSIDE, and it reprints those with its own indentation rather than the
  // file's.
})
