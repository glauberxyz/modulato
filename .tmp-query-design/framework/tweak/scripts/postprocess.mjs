// Post-process the compiled overlay.css for life inside a Shadow DOM on
// ARBITRARY host pages. Two transforms:
//
// 1. Un-gate Tailwind's @property fallback. Chromium ignores @property rules
//    declared in shadow-tree stylesheets, so the registered defaults
//    (--tw-border-style, the shadow/ring stacks, translate) never resolve
//    there: borders render 0 and shadows disappear. Tailwind emits an
//    equivalent defaults block for browsers without @property, but gates it
//    behind Safari/Firefox-only @supports hacks — remove the gate so the
//    defaults always apply.
//
// 2. rem → px (1rem = 16px). Shadow DOM does NOT isolate rem: it always
//    resolves against the HOST document's html font-size, so a site with a
//    custom root type scale (62.5% tricks, fluid vw sizing) shrinks or blows
//    up the whole overlay. Pin every rem to the 16px default at build time —
//    em stays untouched (relative to our own, now-px, font sizes). Media
//    queries convert equivalently (query rem ignores html font-size anyway).
import { readFileSync, writeFileSync } from 'node:fs'

const file = new URL('../src/overlay.css', import.meta.url)
let css = readFileSync(file, 'utf8')

// —— 1. un-gate @layer properties ——
const layerStart = css.indexOf('@layer properties{')
if (layerStart === -1) throw new Error('postprocess: no @layer properties block found')
const supportsStart = css.indexOf('@supports', layerStart)
if (supportsStart === -1 || supportsStart > layerStart + '@layer properties{'.length)
  throw new Error('postprocess: @layer properties is not @supports-gated (already processed?)')
const bodyStart = css.indexOf('{', supportsStart)
let depth = 0
let bodyEnd = -1
for (let i = bodyStart; i < css.length; i += 1) {
  if (css[i] === '{') depth += 1
  else if (css[i] === '}') {
    depth -= 1
    if (depth === 0) {
      bodyEnd = i
      break
    }
  }
}
if (bodyEnd === -1) throw new Error('postprocess: unbalanced braces in @supports block')
css = css.slice(0, supportsStart) + css.slice(bodyStart + 1, bodyEnd) + css.slice(bodyEnd + 1)

// —— 2. rem → px ——
let remCount = 0
css = css.replace(/(\d*\.?\d+)rem\b/g, (_, n) => {
  remCount += 1
  const px = parseFloat(n) * 16
  return `${parseFloat(px.toFixed(4))}px`
})
if (remCount === 0) throw new Error('postprocess: expected rem values to convert — did Tailwind output change?')

writeFileSync(file, css)
console.log(`postprocess: @supports gate removed, ${remCount} rem value(s) pinned to px`)
