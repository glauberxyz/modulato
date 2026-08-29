// Shared token-file operations: the writeback middleware and @modulato/mcp
// both go through here, so a human in the overlay and an agent over MCP are
// editing files with identical semantics.
import fs from 'node:fs'
import path from 'node:path'
import { generateCode, parseModule } from 'magicast'

/**
 * Where a site-wide token module lives: `tokens/<name>.ts`, or the legacy
 * `<name>.ts` at the root, or nowhere. Returns a root-relative id — the same
 * string the registry keys the live object under and this file writes back to.
 */
function singleton(root, name) {
  if (fs.existsSync(path.join(root, 'tokens', `${name}.ts`))) return `/tokens/${name}.ts`
  if (fs.existsSync(path.join(root, `${name}.ts`))) return `/${name}.ts`
  return null
}

/**
 * Root-relative ids of every token module in the project (registry keys).
 *
 * A token module is a file whose default export is plain data: `motion.ts`
 * and `*.motion.ts` (motion tokens, per page and per transition), and the
 * site-wide `tokens/type.ts` (the type system), `tokens/color.ts` (the
 * palette) and `tokens/motion.ts` (the shell). Same shape, same AST-preserving
 * writeback — the only difference is which registry the running page keeps
 * them in.
 */
export function scanMotionFiles(root) {
  const files = []
  for (const name of ['motion', 'type', 'color']) {
    const file = singleton(root, name)
    if (file) files.push(file)
  }
  const walk = (dir, prefix) => {
    if (!fs.existsSync(dir)) return
    for (const dirent of fs.readdirSync(dir, { withFileTypes: true })) {
      if (dirent.isDirectory()) {
        walk(path.join(dir, dirent.name), `${prefix}/${dirent.name}`)
      } else if (dirent.name === 'motion.ts' || dirent.name.endsWith('.motion.ts')) {
        files.push(`${prefix}/${dirent.name}`)
      }
    }
  }
  walk(path.join(root, 'pages'), '/pages')
  walk(path.join(root, 'transitions'), '/transitions')
  return files
}

/** Validate a root-relative token-module id and return its absolute path. */
export function resolveMotionFile(root, file) {
  if (typeof file !== 'string') throw new Error('file must be a string')
  const abs = path.resolve(root, `.${path.sep}${file.replace(/^\//, '')}`)
  const base = path.basename(abs)
  // type.ts and color.ts are the SITE-WIDE ones only: a stray pages/x/type.ts
  // is not a token module, and writing to it would be writing to a file
  // nothing reads. Both spellings count — `tokens/` and the legacy root.
  const isSiteSingleton =
    (base === 'type.ts' || base === 'color.ts') &&
    (abs === path.join(root, 'tokens', base) || abs === path.join(root, base))
  if (
    !abs.startsWith(root + path.sep) ||
    !(base === 'motion.ts' || base.endsWith('.motion.ts') || isSiteSingleton) ||
    !fs.existsSync(abs)
  )
    throw new Error(`not a token module in this project: ${file}`)
  return abs
}


/**
 * The file's own indentation, for recast's printer.
 *
 * Not cosmetic. Recast patches the source surgically only while a node prints
 * back to what it read; when it has to REPRINT one — which adding a key to an
 * object forces — it uses the printer's own `tabWidth`, and that defaults to
 * 4. Against a 2-space file the result is every line of the enclosing object
 * reindented, so one saved slider arrives as a 150-line diff and a review that
 * cannot see what changed. Handing recast the file's real width keeps the
 * write to the lines that actually moved.
 *
 * The smallest indent used by at least two lines: a lone 1- or 3-space
 * continuation should not be mistaken for the step. JSDoc continuation lines
 * (` * …`) are skipped for the same reason — they sit one space in by
 * convention and have nothing to do with the code's indentation.
 */
function detectFormat(source) {
  const counts = new Map()
  let tabbed = 0
  let indented = 0
  for (const line of source.split('\n')) {
    const match = /^([ \t]+)\S/.exec(line)
    if (!match) continue
    indented += 1
    if (match[1].includes('\t')) {
      tabbed += 1
      continue
    }
    if (/^\s*\*/.test(line)) continue
    counts.set(match[1].length, (counts.get(match[1].length) ?? 0) + 1)
  }
  if (tabbed > indented / 2) return { useTabs: true, tabWidth: 2 }
  const width = [...counts.entries()]
    .filter(([, n]) => n >= 2)
    .map(([w]) => w)
    .sort((a, b) => a - b)[0]
  return { useTabs: false, tabWidth: width ?? 2 }
}

function unwrap(mod) {
  let target = mod.exports.default
  if (target && target.$type === 'function-call') target = target.$args[0]
  if (!target)
    throw new Error(
      'no default-exported motion({...}), typography({...}) or colors({...}) found',
    )
  return target
}

/**
 * Evaluate a literal token AST to plain data. Handles what tokens-are-data
 * allows: objects, arrays, strings, numbers (incl. negative), booleans.
 * Anything computed evaluates to undefined and is dropped.
 */
function evalLiteral(node) {
  if (!node) return undefined
  switch (node.type) {
    case 'ObjectExpression': {
      const out = {}
      for (const prop of node.properties) {
        if (prop.type !== 'ObjectProperty' && prop.type !== 'Property') continue
        const key =
          prop.key.type === 'Identifier' ? prop.key.name : String(prop.key.value)
        const value = evalLiteral(prop.value)
        if (value !== undefined) out[key] = value
      }
      return out
    }
    case 'ArrayExpression':
      return node.elements.map((el) => evalLiteral(el))
    case 'StringLiteral':
    case 'NumericLiteral':
    case 'BooleanLiteral':
    case 'Literal':
      return node.value
    case 'UnaryExpression': {
      const inner = evalLiteral(node.argument)
      if (typeof inner !== 'number') return undefined
      return node.operator === '-' ? -inner : node.operator === '+' ? inner : undefined
    }
    default:
      return undefined
  }
}


/** A CSS custom-property name, without the leading dashes. */
const VALID_NAME = /^[a-zA-Z_][a-zA-Z0-9_-]*$/

/** Files a `var(--name)` could plausibly appear in. */
const REFERENCING = ['.scss', '.css', '.sass', '.ts', '.tsx', '.js', '.jsx']

function walkProject(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
    const abs = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'dist' || entry.name === 'build') continue
      walkProject(abs, out)
    } else if (REFERENCING.includes(path.extname(entry.name))) out.push(abs)
  }
  return out
}

/**
 * Rename a color token — the key in color.ts AND every reference to it.
 *
 * This is the largest-blast-radius thing the overlay does, and it exists
 * because the alternative is worse. Renaming only the declaration leaves every
 * `var(--old)` in the project pointing at a property nobody declares any more:
 * `var()` on an undeclared name is not an error, it is a silent fallback, so
 * the color simply stops applying with nothing to say why. In the demo,
 * `--muted` is referenced 26 times.
 *
 * Two rewrites per file, because a custom property appears two ways: as a
 * READ (`var(--old)`) and as a DECLARATION (`--old:`, e.g. a `.is-dark` block
 * overriding it). Missing the second would leave a dead override behind.
 *
 * `(?![\w-])` rather than `\b` for the boundary: `\b` sits happily between
 * `d` and `-`, so renaming `muted` would also rewrite `--muted-strong`.
 *
 * Returns what it touched, so the overlay can show the blast radius rather
 * than claim a quiet success.
 */
export function renameColor(root, from, to) {
  if (typeof from !== 'string' || typeof to !== 'string')
    throw new Error('from and to must be strings')
  const oldName = from.replace(/^--/, '')
  const newName = to.replace(/^--/, '')
  if (!VALID_NAME.test(oldName) || !VALID_NAME.test(newName))
    throw new Error(
      `not a usable custom-property name: "${to}" — letters, digits, _ and - only, starting with a letter`,
    )
  if (oldName === newName) return { renamed: 0, files: [] }

  const colorFile = singleton(root, 'color')
  if (!colorFile) throw new Error('no color.ts in this project')
  const abs = resolveMotionFile(root, colorFile)
  const source = fs.readFileSync(abs, 'utf8')

  // Scope the key rename to the colors({...}) literal, so a color NAMED in a
  // comment or a string elsewhere in the file is left alone.
  const callAt = source.search(/\bcolors\s*\(/)
  if (callAt === -1) throw new Error('no colors({...}) call in color.ts')
  const open = source.indexOf('{', callAt)
  let depth = 0
  let close = -1
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1
    else if (source[i] === '}') {
      depth -= 1
      if (depth === 0) {
        close = i
        break
      }
    }
  }
  if (close === -1) throw new Error('unbalanced braces in color.ts')

  const body = source.slice(open, close)
  const keyRe = new RegExp(`(^|[\\s,{])(['"]?)${oldName}\\2(\\s*:)`, 'm')
  if (!keyRe.test(body)) throw new Error(`no color named "${oldName}" in color.ts`)
  if (new RegExp(`(^|[\\s,{])(['"]?)${newName}\\2(\\s*:)`, 'm').test(body))
    throw new Error(`color.ts already has a color named "${newName}"`)
  // Quote the new key only when it needs it — a dashed name is not an
  // identifier, and an unquoted one would be a syntax error.
  const quoted = VALID_NAME.test(newName) && !newName.includes('-')
  const replacement = quoted ? `$1${newName}$3` : `$1'${newName}'$3`
  fs.writeFileSync(
    abs,
    source.slice(0, open) + body.replace(keyRe, replacement) + source.slice(close),
  )

  const readRe = new RegExp(`(var\\(\\s*--)${oldName}(?![\\w-])`, 'g')
  const declRe = new RegExp(`(--)${oldName}(?![\\w-])(\\s*:)`, 'g')
  const files = []
  let renamed = 0
  for (const file of walkProject(root)) {
    if (file === abs) continue
    const text = fs.readFileSync(file, 'utf8')
    let hits = 0
    const next = text
      .replace(readRe, (...m) => (hits += 1, `${m[1]}${newName}`))
      .replace(declRe, (...m) => (hits += 1, `${m[1]}${newName}${m[2]}`))
    if (!hits) continue
    fs.writeFileSync(file, next)
    files.push({ file: `/${path.relative(root, file).split(path.sep).join('/')}`, hits })
    renamed += hits
  }
  return { renamed, files }
}

/** Read a motion.ts's token object from source (no execution). */
export function readTokens(root, file) {
  const abs = resolveMotionFile(root, file)
  const mod = parseModule(fs.readFileSync(abs, 'utf8'))
  const target = unwrap(mod)
  return evalLiteral(target.$ast ?? target)
}

/**
 * Apply `changes` ([{ path: string[], value }]) into a motion.ts with an
 * AST-preserving edit. Returns the dotted paths that were applied. The dev
 * server's HMR merge propagates the new values into the running page.
 */
export function writeTokens(root, file, changes) {
  if (!Array.isArray(changes)) throw new Error('changes must be an array')
  const abs = resolveMotionFile(root, file)
  const source = fs.readFileSync(abs, 'utf8')
  const mod = parseModule(source)
  const target = unwrap(mod)

  const applied = []
  for (const change of changes) {
    const { path: tokenPath, value } = change ?? {}
    if (
      !Array.isArray(tokenPath) ||
      !tokenPath.length ||
      !tokenPath.every((k) => typeof k === 'string') ||
      !['number', 'string', 'boolean'].includes(typeof value)
    )
      continue
    // Missing intermediate objects are CREATED. The one caller that needs it
    // is a per-selector typography override — `overrides['.home__headline']`
    // is a key nobody wrote yet, and refusing it would mean Tweak could only
    // ever edit values somebody had already typed by hand. The path is fully
    // specified by the request, so nothing is invented here that the caller
    // did not name.
    let node = target
    let ok = true
    for (const key of tokenPath.slice(0, -1)) {
      if (node[key] === undefined) node[key] = {}
      node = node[key]
      // A segment that exists but is a string or a number: overwriting it with
      // a container would silently destroy a real value.
      if (!node || typeof node !== 'object') {
        ok = false
        break
      }
    }
    if (!ok) continue
    node[tokenPath[tokenPath.length - 1]] = value
    applied.push(tokenPath.join('.'))
  }

  const { code } = generateCode(mod, { format: detectFormat(source) })
  // Recast drops a trailing newline when it reprints; a file that had one
  // keeps it, so a save never shows up as a spurious no-newline-at-EOF.
  fs.writeFileSync(abs, source.endsWith('\n') && !code.endsWith('\n') ? `${code}\n` : code)
  return applied
}
