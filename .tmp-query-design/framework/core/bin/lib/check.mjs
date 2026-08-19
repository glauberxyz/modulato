import fs from 'node:fs'
import path from 'node:path'
import { scanRoutes, scanTransitions, slugRouteId } from './scan.mjs'

const COMPANIONS = ['styles.scss', 'config.ts', 'intro.ts', 'motion.ts', 'server.ts']

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

/**
 * Validate the project's contracts. Every message says how to fix the
 * problem — errors teach, they don't just point.
 */

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

  // Page components must have a default export.
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

  return { ok: errors.length === 0, errors, warnings }
}
