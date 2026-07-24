// The overlay's stylesheet always lives inside a Shadow DOM — and Chromium
// ignores @property rules declared in shadow-tree stylesheets, so Tailwind's
// registered defaults (--tw-border-style, the shadow/ring stacks, translate)
// never resolve there: borders render 0 and shadows disappear. Tailwind
// already emits an equivalent defaults block for browsers without @property,
// but gates it behind Safari/Firefox-only @supports hacks. This step removes
// that gate from the compiled overlay.css so the defaults always apply.
import { readFileSync, writeFileSync } from 'node:fs'

const file = new URL('../src/overlay.css', import.meta.url)
let css = readFileSync(file, 'utf8')

const layerStart = css.indexOf('@layer properties{')
if (layerStart === -1) throw new Error('ungate-properties: no @layer properties block found')
const supportsStart = css.indexOf('@supports', layerStart)
if (supportsStart === -1 || supportsStart > layerStart + '@layer properties{'.length)
  throw new Error('ungate-properties: @layer properties is not @supports-gated (already ungated?)')

// Walk the braces to find the @supports block's body boundaries.
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
if (bodyEnd === -1) throw new Error('ungate-properties: unbalanced braces in @supports block')

// Drop the @supports wrapper, keep its body.
css = css.slice(0, supportsStart) + css.slice(bodyStart + 1, bodyEnd) + css.slice(bodyEnd + 1)
writeFileSync(file, css)
console.log('ungate-properties: @supports gate removed from @layer properties')
