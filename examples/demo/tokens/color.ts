import { colors } from 'modulato'

/**
 * The palette — every color on this site, as DATA.
 *
 * Each key becomes a `:root` custom property (`paper` is `--paper`), inlined
 * into every SSR response, so the `var(--paper)` already written across the
 * stylesheets keeps working unchanged. Only the declaration moved.
 *
 * What is NOT here: the `.is-dark` block in styles/tokens.scss. That is a
 * selector question rather than a palette one — it redefines these same
 * variables for a surface, and it keeps working by out-specifying the `:root`
 * this generates.
 */
export default colors({
  // Two worlds. Chapters print dark-on-paper; the index and the darkroom
  // invert — the site's own "plate" and "proof".
  paper: '#f4f1ea',
  ink: '#231f20',
  muted: '#7a7a75',
  rule: '#d6d1c6',
  // A second, brighter sheet for apparatus laid UNDER the argument — the
  // chapter's sources band. Paper is warm and slightly gray; this is the white
  // it would be printed on, so the change of surface reads as a change of
  // register rather than as a panel.
  'paper-bright': '#ffffff',

  'dark-paper': '#14110f',
  'dark-ink': '#f4f1ea',
  'dark-muted': '#8b857c',
  'dark-rule': '#332e29',
  // Brighter than the dark surface, same lift as `paper-bright` is on paper.
  'dark-paper-bright': '#1c1916',

  // The four plates. Used ONLY where CMYK is the subject (chapter III and the
  // plate-colored link dots) — everywhere else the site is monochrome, so the
  // color arrives as an argument, not as decoration.
  'plate-c': '#00a0c6',
  'plate-m': '#d81e78',
  'plate-y': '#f5c400',
  'plate-k': '#231f20',

  // Selection: white paper, dark ink — the same two values the site is printed
  // with, whichever surface you are on.
  'select-bg': '#ffffff',
  'select-fg': '#231f20',
})
