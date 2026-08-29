import fs from 'node:fs'
import path from 'node:path'
import { scanRoutes, scanTransitions, slugRouteId } from './scan.mjs'

const COMPANIONS = ['styles.scss', 'config.ts', 'intro.ts', 'motion.ts', 'server.ts']

/**
 * Where a site-wide token module lives: `tokens/<name>.ts`, or the legacy
 * `<name>.ts` at the root, or nowhere. Root-relative, so it doubles as the
 * label a message names the file by.
 */
function tokenFile(root, name) {
  if (fs.existsSync(path.join(root, 'tokens', `${name}.ts`))) return `tokens/${name}.ts`
  if (fs.existsSync(path.join(root, `${name}.ts`))) return `${name}.ts`
  return null
}

// GSAP's built-in ease vocabulary — a declared ease may not shadow one of
// these, since registering the name would clobber GSAP's own for the page.
// Includes the legacy aliases (quad/cubic/quart/quint/strong/power0) that
// still resolve in gsap 3.x, and matching is case-insensitive: the
// capitalized forms ('Expo') resolve to OBJECTS in gsap's ease map, so a
// token using one makes GSAP call a non-function.
const GSAP_BUILTIN_EASES = new Set(
  [
    'none',
    'linear',
    ...[
      'power0', 'power1', 'power2', 'power3', 'power4',
      'quad', 'cubic', 'quart', 'quint', 'strong',
      'sine', 'expo', 'circ', 'back', 'elastic', 'bounce',
      'steps', 'rough', 'slow',
    ].flatMap((family) => [family, `${family}.in`, `${family}.out`, `${family}.inOut`]),
  ].map((name) => name.toLowerCase()),
)

const CUBIC_BEZIER =
  /^cubic-bezier\(\s*(-?(?:\d+\.?\d*|\.\d+))\s*,\s*(-?(?:\d+\.?\d*|\.\d+))\s*,\s*(-?(?:\d+\.?\d*|\.\d+))\s*,\s*(-?(?:\d+\.?\d*|\.\d+))\s*\)$/

/** Blank out // and /* *\/ comments, keeping offsets so brace matching and
 * string scanning below never trip over commented-out config. */
function stripComments(source) {
  let out = ''
  let i = 0
  while (i < source.length) {
    const ch = source[i]
    const next = source[i + 1]
    if (ch === '/' && next === '/') {
      while (i < source.length && source[i] !== '\n') i += 1
    } else if (ch === '/' && next === '*') {
      i += 2
      while (i < source.length && !(source[i] === '*' && source[i + 1] === '/')) i += 1
      i += 2
    } else if (ch === "'" || ch === '"' || ch === '`') {
      const quote = ch
      out += ch
      i += 1
      while (i < source.length && source[i] !== quote) {
        if (source[i] === '\\') {
          out += source[i] + (source[i + 1] ?? '')
          i += 2
          continue
        }
        out += source[i]
        i += 1
      }
      out += quote
      i += 1
    } else {
      out += ch
      i += 1
    }
  }
  return out
}

/** The `{...}` body following `key:`, found by brace matching (a regex can't
 * tell which `}` closes the block). Returns null when the key is absent. */
function objectBody(source, key) {
  const at = source.search(new RegExp(`\\b${key}\\s*:\\s*\\{`))
  if (at === -1) return null
  const open = source.indexOf('{', at)
  let depth = 0
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1
    else if (source[i] === '}') {
      depth -= 1
      if (depth === 0) return source.slice(open + 1, i)
    }
  }
  return null
}

/** Split an object body on its TOP-LEVEL commas. */
function splitEntries(body) {
  const entries = []
  let depth = 0
  let current = ''
  let quote = null
  for (let i = 0; i < body.length; i += 1) {
    const ch = body[i]
    if (quote) {
      current += ch
      if (ch === '\\') {
        current += body[i + 1] ?? ''
        i += 1
      } else if (ch === quote) quote = null
      continue
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch
      current += ch
      continue
    }
    if ('{[('.includes(ch)) depth += 1
    else if ('}])'.includes(ch)) depth -= 1
    if (ch === ',' && depth === 0) {
      entries.push(current)
      current = ''
      continue
    }
    current += ch
  }
  if (current.trim()) entries.push(current)
  return entries
}

/**
 * Validate `eases` in modulato.config.ts. Both animation backends fail badly
 * on a bad curve and in OPPOSITE ways — GSAP silently falls back to quad.out,
 * WAAPI throws at animate() — so the mistakes are caught here instead.
 * Read from the source text (comments stripped, braces matched): the config
 * runs in Node and may hold secrets, so it is never imported.
 */
function checkEases(root, error) {
  const file = path.resolve(root, 'modulato.config.ts')
  if (!fs.existsSync(file)) return
  const body = objectBody(stripComments(fs.readFileSync(file, 'utf8')), 'eases')
  if (body === null) return
  for (const entry of splitEntries(body)) {
    if (!entry.trim()) continue
    const parsed = entry.match(/^\s*(?:(['"])([^'"]+)\1|([\w$]+))\s*:\s*([\s\S]+)$/)
    if (!parsed) {
      // A spread (...BRAND_EASES) or shorthand — invisible to the static
      // extractor, so the curves would never reach the client.
      error(
        'modulato.config.ts',
        `eases entry ${JSON.stringify(entry.trim())} is not a "name: 'cubic-bezier(…)'" pair — the client extracts these statically, so spreads and shorthand never reach it. Write each curve out literally.`,
      )
      continue
    }
    const name = parsed[2] ?? parsed[3]
    const raw = parsed[4].trim()
    if (GSAP_BUILTIN_EASES.has(name.toLowerCase())) {
      error(
        'modulato.config.ts',
        `ease "${name}" shadows a built-in GSAP ease — registering it would replace GSAP's own for the whole page. Rename it (e.g. "brand${name[0].toUpperCase()}${name.slice(1)}").`,
      )
      continue
    }
    if (!/^(['"]).*\1$/s.test(raw)) {
      error(
        'modulato.config.ts',
        `ease "${name}" must be a literal quoted string — got ${JSON.stringify(raw)}. Template literals, constants and imported values are invisible to the static extractor, so the curve would silently never reach the browser.`,
      )
      continue
    }
    const value = raw.slice(1, -1)
    const points = CUBIC_BEZIER.exec(value.trim())
    if (!points) {
      error(
        'modulato.config.ts',
        `ease "${name}" must be a cubic-bezier(x1, y1, x2, y2) string — got ${JSON.stringify(value)}. A single cubic is the one curve GSAP and CSS transitions both express exactly; grab one from cubic-bezier.com.`,
      )
      continue
    }
    const [x1, x2] = [points[1], points[3]].map(Number)
    if (Number.isNaN(x1) || Number.isNaN(x2))
      error(
        'modulato.config.ts',
        `ease "${name}" has a malformed number in ${JSON.stringify(value)} — check for a stray "." or duplicate decimal point.`,
      )
    else if (x1 < 0 || x1 > 1 || x2 < 0 || x2 > 1)
      error(
        'modulato.config.ts',
        `ease "${name}" has an x control point outside 0–1 (${x1}, ${x2}) — CSS rejects it and element.animate() throws. Only the y values may overshoot.`,
      )
  }
}

function groupPathsIn(body, prefix = [], out = new Set()) {
  for (const entry of splitEntries(body)) {
    const m = entry.match(/^\s*(?:(['"])([^'"]+)\1|([\w$]+))\s*:\s*\{/)
    if (!m) continue
    const name = m[2] ?? m[3]
    const nested = objectBody(entry, name)
    const here = [...prefix, name]
    out.add(here.join('.'))
    if (nested !== null) groupPathsIn(nested, here, out)
  }
  return out
}

/**
 * Every dotted path in a motion file's `keywords` export must name a real
 * group in that file's `motion({...})`.
 *
 * The keywords are what someone searching the Tweak overlay actually types —
 * a group is named for what it IS in the code, they search for what it DOES.
 * Nothing enforces the link at runtime: the overlay looks the path up, finds
 * nothing, and the group is simply unfindable by the word that was supposed
 * to find it. Renaming a group is exactly when that happens, and it happens
 * silently. A warning, not an error: a stale keyword costs discoverability,
 * never correctness.
 */
function checkMotionKeywords(root, warn) {
  const files = []
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, e.name)
      if (e.isDirectory()) {
        if (e.name !== 'node_modules' && !e.name.startsWith('.')) walk(abs)
      } else if (e.name === 'motion.ts' || e.name.endsWith('.motion.ts')) files.push(abs)
    }
  }
  walk(root)

  for (const abs of files) {
    const src = stripComments(fs.readFileSync(abs, 'utf8'))
    // `export const keywords: Record<string, string[]> = {` — the annotation
    // sits between the name and the brace, so this cannot use objectBody(),
    // which looks for `name: {`.
    const kwAt = src.search(/export\s+const\s+keywords\b/)
    if (kwAt === -1) continue
    const kw = sliceBraces(src, src.indexOf('{', kwAt))
    if (kw === null) continue
    const callAt = src.search(/\bmotion\s*\(/)
    if (callAt === -1) continue
    const tokenBody = sliceBraces(src, src.indexOf('{', callAt))
    if (tokenBody === null) continue
    const groups = groupPathsIn(tokenBody)
    const rel = path.relative(root, abs)
    for (const entry of splitEntries(kw)) {
      const m = entry.match(/^\s*(?:(['"])([^'"]+)\1|([\w$]+))\s*:/)
      if (!m) continue
      const dotted = m[2] ?? m[3]
      if (!groups.has(dotted))
        warn(
          rel,
          `keywords entry "${dotted}" names no group in this file — a rename left it dangling, so nothing it lists will find anything in the Tweak overlay. Point it at a real group or drop it.`,
        )
    }
  }
}


/**
 * Typography contracts, when the project has a `type.ts`.
 *
 * TWO failures, both of which look like nothing until somebody reads the page:
 *
 * 1. A stylesheet reads `--type-<style>-size` for a style that does not
 *    exist. `var()` on an undeclared property falls back silently — the text
 *    renders at the inherited size and nothing anywhere says why. This is what
 *    a rename in type.ts leaves behind, and it is the single most likely way
 *    the system breaks.
 * 2. A page stylesheet declares font properties directly. It works, which is
 *    the problem: the value is now outside the type system, invisible to the
 *    styleguide and un-editable in Tweak, and the next retypesetting misses
 *    it. A warning, not an error — a project is allowed to make an exception,
 *    just not by accident.
 */
function checkTypography(root, error, warn) {
  const rel = tokenFile(root, 'type')
  if (!rel) return
  const typeFile = path.resolve(root, rel)
  // Messages name the file where it actually is: a project on the legacy root
  // layout should not be told to look in tokens/.
  const label = rel

  const src = stripComments(fs.readFileSync(typeFile, 'utf8'))
  const callAt = src.search(/\btypography\s*\(/)
  if (callAt === -1) {
    error(label, 'no typography({...}) call — the default export must be one, or nothing reads it.')
    return
  }
  const body = sliceBraces(src, src.indexOf('{', callAt))
  if (body === null) return
  const stylesBody = objectBody(body, 'styles')
  if (stylesBody === null) {
    error(label, 'no `styles` — a type system with no named styles emits no CSS.')
    return
  }
  const styles = new Set()
  for (const entry of splitEntries(stylesBody)) {
    const m = entry.match(/^\s*(?:(['"])([^'"]+)\1|([\w$]+))\s*:/)
    if (m) styles.add(m[2] ?? m[3])
  }
  const scaleBody = objectBody(body, 'scale')
  const steps = new Set()
  if (scaleBody !== null)
    for (const entry of splitEntries(scaleBody)) {
      const m = entry.match(/^\s*(?:(['"])([^'"]+)\1|([\w$]+))\s*:/)
      if (m) steps.add(m[2] ?? m[3])
      fluidByHand(entry, 'scale step', warn, label)
    }
  for (const entry of splitEntries(stylesBody)) {
    const name = entry.match(/^\s*(?:(['"])([^'"]+)\1|([\w$]+))\s*:/)
    // A quoted value is taken whole: a `clamp()` has commas inside it, so
    // stopping at the first one would cut the string in half.
    const size = entry.match(/\bsize\s*:\s*(?:(['"])([^'"]*)\1|([^,\n}]+))/)
    if (name && size)
      fluidByHand(`${name[2] ?? name[3]}: ${size[2] ?? size[3]}`, 'style', warn, label)
  }

  // The suffixes typeCss emits. Anything else after a style name is a typo in
  // its own right, but naming the known ones keeps this from firing on a
  // project's unrelated `--type-` variable.
  const SUFFIXES = ['family', 'size', 'leading', 'tracking', 'weight', 'case', 'wrap']
  const sheets = []
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, e.name)
      if (e.isDirectory()) {
        if (e.name !== 'node_modules' && !e.name.startsWith('.') && e.name !== 'dist') walk(abs)
      } else if (e.name.endsWith('.scss') || e.name.endsWith('.css')) sheets.push(abs)
    }
  }
  walk(root)

  for (const abs of sheets) {
    const rel = path.relative(root, abs).split(path.sep).join('/')
    const text = fs.readFileSync(abs, 'utf8')
    for (const m of text.matchAll(/--type-([a-zA-Z0-9_-]+)/g)) {
      const name = m[1]
      // Interpolated by SCSS (`--type-#{$name}-size`) — the shared mixin, and
      // not something this can resolve without running Sass.
      if (name.startsWith('#')) continue
      if (name.startsWith('font-')) continue
      if (name.startsWith('size-')) {
        const step = name.slice('size-'.length)
        if (steps.size && !steps.has(step))
          error(
            rel,
            `--type-size-${step} is not a step in type.ts's scale (${[...steps].join(', ')}). var() falls back silently, so this renders at the inherited size with nothing to say why.`,
          )
        continue
      }
      const suffix = SUFFIXES.find((s) => name.endsWith(`-${s}`))
      if (!suffix) continue
      const style = name.slice(0, -(suffix.length + 1))
      if (!styles.has(style))
        error(
          rel,
          `--type-${style}-${suffix} names no style in type.ts (${[...styles].join(', ')}). A rename left this behind; var() falls back silently, so the text just renders wrong.`,
        )
    }
  }

  // Page stylesheets are layout. A `@include` of the shared mixin is how type
  // arrives; a raw declaration is how it escapes.
  //
  // Only font-family and font-size, deliberately. Those two are unambiguous:
  // a page has no business naming a face or a size the scale does not contain.
  // line-height and letter-spacing are as often layout as they are type —
  // `line-height: 1` on a box, tracking on a rendered specimen — and warning
  // on them cried wolf often enough that the real warnings stopped reading as
  // warnings.
  const pagesDir = path.resolve(root, 'pages')
  for (const abs of sheets) {
    if (!abs.startsWith(pagesDir + path.sep)) continue
    const rel = path.relative(root, abs).split(path.sep).join('/')
    const text = stripComments(fs.readFileSync(abs, 'utf8'))
    for (const property of ['font-family', 'font-size']) {
      const re = new RegExp(`(^|[;{\\s])${property}\\s*:\\s*([^;}]+)`, 'g')
      for (const m of text.matchAll(re)) {
        // Reading a type variable IS using the system — that is the supported
        // way to take one step off a style.
        if (/var\(\s*--type-/.test(m[2])) continue
        warn(
          rel,
          `declares ${property} directly — type belongs in type.ts, where the styleguide can show it and Tweak can edit it. Use @include type.style('<name>'), or var(--type-size-<step>) for one step off a style.`,
        )
        break
      }
    }

    // Layout is px. The other half of the same rule as the two properties
    // above: type ships in rem so a reader's font-size setting can reach it,
    // and layout stays px so the boxes do not inflate to match. rem gaps
    // around rem text are a page that is merely zoomed, which is what the
    // zoom control the reader did not press already does.
    //
    // Media queries are exempt, and not as a courtesy: a breakpoint in rem is
    // a real position — "switch when the text gets big" rather than "when the
    // window does" — and warning on it would be this check having an opinion
    // it has not earned. `em` and `ch` are exempt for the same reason, since
    // those say the length tracks the type it holds, which is the case the
    // rule is FOR.
    const remLines = []
    for (const [i, line] of text.split('\n').entries()) {
      if (/@media|@container/.test(line)) continue
      if (/(^|[^\w.-])-?\d*\.?\d+rem\b/.test(line)) remLines.push(i + 1)
    }
    if (remLines.length)
      warn(
        rel,
        `sizes layout in rem (line${remLines.length > 1 ? 's' : ''} ${remLines.slice(0, 5).join(', ')}${remLines.length > 5 ? `, +${remLines.length - 5} more` : ''}) — layout is px, so text can grow with a reader's font-size setting without the boxes around it growing too. Use px, or em/ch where the length genuinely tracks the type it holds.`,
      )
  }
}

/**
 * `ctx.request` in a page's config.ts must be guarded.
 *
 * `load()` and `meta()` run in BOTH places — server-side for the first paint,
 * and in the BROWSER on every navigation after it — and `request` only exists
 * in the first. So unguarded, the page works when you type its URL and throws
 * the moment somebody reaches it by clicking a link, which is the one order
 * nobody tests in. An error rather than a warning: the failure is total, and
 * arrives after the code looked like it worked.
 *
 * Read from the source text, like everything else here — config.ts runs in
 * Node and may hold secrets, so it is never imported.
 */
function checkLoaderRequest(root, error) {
  const pagesDir = path.resolve(root, 'pages')
  const files = []
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, e.name)
      if (e.isDirectory()) walk(abs)
      else if (e.name === 'config.ts') files.push(abs)
    }
  }
  walk(pagesDir)

  for (const abs of files) {
    const src = stripComments(fs.readFileSync(abs, 'utf8'))
    if (!/\brequest\b/.test(src)) continue
    // A locally-declared `request` is somebody else's variable — a Request
    // being built to fetch something, most likely — not the loader's.
    if (/\b(?:const|let|var|function)\s+request\b/.test(src)) continue

    // A member access with no `?.` in front of it.
    if (!/(?:^|[^?.\w])(?:\w+\.)?request\s*\./.test(src)) continue

    const guarded =
      /if\s*\(\s*!\s*(?:\w+\.)?request\b/.test(src) ||
      /(?:\w+\.)?request\s*(?:===|!==)\s*undefined/.test(src) ||
      /typeof\s+(?:\w+\.)?request\b/.test(src) ||
      /(?:\w+\.)?request\s*&&/.test(src) ||
      /(?:\w+\.)?request\s*\?[^.?]/.test(src)
    if (guarded) continue

    error(
      path.relative(root, abs),
      'reads `request` without handling its absence — `load()` and `meta()` also run in the BROWSER on every client navigation, where there is no request, so this throws on the first link click and not before. Guard it (`if (!request) …` for the client path) or reach it with `request?.`. It can never hold a secret either: whatever you derive from it becomes props, and props ship to the client.',
    )
  }
}

/** The object literal starting at `open`, body only. */
function sliceBraces(source, open) {
  if (open === -1) return null
  let depth = 0
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1
    else if (source[i] === '}') {
      depth -= 1
      if (depth === 0) return source.slice(open + 1, i)
    }
  }
  return null
}

/**
 * The styleguide page is the framework's now, and a project scaffolded before
 * that still has the old hand-written one: ~200 lines of JSX plus a
 * `styles.scss`, styled with the site's own type mixins and colour variables.
 *
 * Nothing breaks by keeping it — it is the project's own code reading the
 * project's own tokens — so these are warnings, not errors. But nothing tells
 * anyone it is out of date either: the stale stylesheet stays auto-imported
 * and invisible, and every agent that implements a design re-skins the page
 * along with the rest of `pages/`, which is the whole reason it moved into the
 * framework. A project is allowed to keep its own page; just not by accident.
 */
function checkStyleguide(root, warn) {
  // Any page folder, not just `styleguide/` — the demo's is `styles/`, and a
  // project may have named it anything.
  const pagesDir = path.resolve(root, 'pages')
  if (!fs.existsSync(pagesDir)) return
  const FIX =
    "the styleguide ships with the framework now. Make page.tsx `import { Styleguide } from 'modulato/styleguide'` and render `<Styleguide type={type} colors={colors} />`, delete the page's styles.scss, and hide your shell on it with `body:has([data-modulato-styleguide]) .menu { display: none }` in styles/global.scss."
  for (const entry of fs.readdirSync(pagesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const dir = path.join(pagesDir, entry.name)
    const page = path.join(dir, 'page.tsx')
    if (!fs.existsSync(page)) continue
    const source = fs.readFileSync(page, 'utf8')
    if (source.includes('modulato/styleguide')) {
      // Adopted the component but kept the old stylesheet beside it.
      if (fs.existsSync(path.join(dir, 'styles.scss')))
        warn(
          `pages/${entry.name}/styles.scss`,
          'the styleguide brings its own styles — this file is dead CSS targeting classes the page no longer renders. Delete it.',
        )
      continue
    }
    // The old scaffold, recognised by the classes it renders rather than by
    // its folder name.
    if (/className="guide|guide__specimen|type-\$\{name\}/.test(source))
      warn(`pages/${entry.name}/page.tsx`, FIX)
  }
}

/** rem in `type.ts` is px as designed; the file's own unit rule (see remFrom). */
const REM = 16

/**
 * A size written as a `clamp()` (or a bare `vw`) instead of as its two ends.
 *
 * It is legal and passed through untouched, which is exactly why it needs
 * saying: the commonest way into a Modulato project is porting one, and the
 * thing being ported is a stylesheet full of solved clamps. Translating them
 * across verbatim is the obvious move and the wrong one — the string encodes a
 * viewport range nobody wrote down, and Tweak can name it but not move it,
 * while `{ min, max }` is two numbers with a slider each and a `fluid` range
 * stated once for the whole scale.
 *
 * The ends are recoverable from a plain `clamp(A, …, B)`, so the warning says
 * what to write rather than only what is wrong.
 */
function fluidByHand(entry, kind, warn, label) {
  const m = entry.match(/^\s*(?:(['"])([^'"]+)\1|([\w$]+))\s*:\s*([\s\S]+)$/)
  if (!m) return
  const key = m[2] ?? m[3]
  const value = m[4]
  if (!/clamp\(|[\d.]v[wh]\b/.test(value)) return
  const ends = value.match(/clamp\(\s*([\d.]+)(rem|px)\s*,[^,]*,\s*([\d.]+)(rem|px)\s*\)/)
  const px = (n, unit) => Math.round(Number(n) * (unit === 'rem' ? REM : 1))
  const fix = ends
    ? `\`${key}: { min: ${px(ends[1], ends[2])}, max: ${px(ends[3], ends[4])} }\``
    : `\`${key}: { min: <px>, max: <px> }\``
  warn(
    label,
    `${kind} \`${key}\` is a hand-written fluid size. Write its two ends instead — ${fix} — and state the viewport range once in \`fluid\`. Modulato solves the clamp() from them, in rem, with the accessible intercept; a string encodes a range nobody wrote down and Tweak can name but not move.`,
  )
}

/**
 * The site-wide token modules belong in `tokens/`.
 *
 * `type.ts`, `color.ts` and the shell's `motion.ts` are one set — the three
 * files that say how the site is set, all data, all editable in the overlay —
 * and a folder says so where three loose files at the root do not. The root
 * spelling still works, so this is a warning: nothing breaks, but a project
 * that stays split between the two layouts is the one place a reader has to
 * guess which file is live.
 */
function checkTokensFolder(root, warn) {
  const stray = ['type', 'color', 'motion'].filter(
    (name) =>
      fs.existsSync(path.join(root, `${name}.ts`)) &&
      !fs.existsSync(path.join(root, 'tokens', `${name}.ts`)),
  )
  if (!stray.length) return
  const list = stray.map((name) => `${name}.ts`).join(', ')
  const moves = stray.map((name) => `git mv ${name}.ts tokens/${name}.ts`).join(' && ')
  warn(
    'tokens/',
    `${list} ${stray.length === 1 ? 'is' : 'are'} at the project root — move ${stray.length === 1 ? 'it' : 'them'} into \`tokens/\`: \`mkdir -p tokens && ${moves}\`. Then fix the imports that name ${stray.length === 1 ? 'it' : 'them'} (\`../motion\` becomes \`../tokens/motion\`, \`../../type\` becomes \`../../tokens/type\`) and add \`"tokens"\` to tsconfig.json's \`include\` in place of the ${stray.length === 1 ? 'entry' : 'entries'} for ${list}.`,
  )
}

/**
 * Validate the project's contracts. Every message says how to fix the
 * problem — errors teach, they don't just point.
 */
export function check(root) {
  const errors = []
  const warnings = []
  const error = (file, message) => errors.push({ file, message })
  const warn = (file, message) => warnings.push({ file, message })

  const pagesDir = path.resolve(root, 'pages')
  if (!fs.existsSync(pagesDir)) {
    error('pages', 'no pages/ directory — create your first page: modulato new page home')
    return { ok: false, errors, warnings }
  }

  const routes = scanRoutes(root)
  if (!routes.length)
    error(
      'pages',
      'no page folders found — a page is a folder containing page.tsx: modulato new page home',
    )

  // Orphan companion files: styles/config/intro next to no page.tsx.
  const walk = (dir, prefix) => {
    for (const dirent of fs.readdirSync(dir, { withFileTypes: true })) {
      if (dirent.isDirectory()) {
        walk(path.join(dir, dirent.name), prefix ? `${prefix}/${dirent.name}` : dirent.name)
        continue
      }
      if (!prefix) continue
      if (!COMPANIONS.includes(dirent.name)) continue
      if (!fs.existsSync(path.join(dir, 'page.tsx')))
        error(
          `pages/${prefix}/${dirent.name}`,
          `orphaned — pages/${prefix}/ has no page.tsx, so this file is never loaded. Add page.tsx or remove the folder.`,
        )
    }
  }
  walk(pagesDir, '')

  for (const route of routes) {
    const source = fs.readFileSync(path.join(route.dir, 'page.tsx'), 'utf8')
    if (!/export\s+default/.test(source))
      error(
        `pages/${route.id}/page.tsx`,
        'no default export — a page must default-export its React component.',
      )
  }

  // Two routes may never shorten to the same transition-filename form.
  const slugOwners = new Map()
  for (const route of routes) {
    const slug = slugRouteId(route.id)
    if (slugOwners.has(slug))
      error(
        `pages/${route.id}`,
        `routes "${slugOwners.get(slug)}" and "${route.id}" both shorten to "${slug}" in transition filenames — rename one of the folders.`,
      )
    slugOwners.set(slug, route.id)
  }

  // Transition pair files must reference existing routes.
  const known = routes.map((r) => r.id)
  for (const entry of scanTransitions(root)) {
    if (entry.isDefault) continue
    if (entry.malformed) {
      error(
        `transitions/${entry.file}`,
        `malformed name — expected <from>__<to>.ts (double underscore), where a route id is written with dashes ("/" becomes "-", param brackets drop): e.g. ${
          known[1] ? `${slugRouteId(known[0])}__${slugRouteId(known[1])}.ts` : 'home__about.ts'
        }`,
      )
      continue
    }
    for (const [side, id] of [
      ['from', entry.from],
      ['to', entry.to],
    ]) {
      if (!known.includes(id))
        error(
          `transitions/${entry.file}`,
          `"${id}" (${side} side) is not a page. Known routes: ${known.join(', ')}. This transition can never run.`,
        )
    }
    if (entry.legacy && known.includes(entry.from) && known.includes(entry.to))
      warn(
        `transitions/${entry.file}`,
        `legacy dot/bracket name — still works, but the dash form is the convention now: rename to ${slugRouteId(entry.from)}__${slugRouteId(entry.to)}.ts (and its .motion.ts sibling, if any)`,
      )
  }

  // The shell must render <PageOutlet/> or no page ever mounts.
  const appFile = path.resolve(root, 'app.tsx')
  if (fs.existsSync(appFile)) {
    const source = fs.readFileSync(appFile, 'utf8')
    if (!source.includes('PageOutlet'))
      error(
        'app.tsx',
        'does not render <PageOutlet/> — pages mount there; without it navigation renders nothing.',
      )
  }

  // A root intro.ts is the shell intro; a stray one in pages/ root is a
  // classic misplacement.
  if (fs.existsSync(path.join(pagesDir, 'intro.ts')))
    warn(
      'pages/intro.ts',
      'intro.ts directly inside pages/ is never loaded — the shell intro lives at the project root (./intro.ts), page intros inside their page folder.',
    )

  checkEases(root, error)
  checkMotionKeywords(root, warn)
  checkLoaderRequest(root, error)
  checkTypography(root, error, warn)
  checkStyleguide(root, warn)
  checkTokensFolder(root, warn)

  return { ok: errors.length === 0, errors, warnings }
}
