// Shared token-file operations: the writeback middleware and @modulato/mcp
// both go through here, so a human in the overlay and an agent over MCP are
// editing files with identical semantics.
import fs from 'node:fs'
import path from 'node:path'
import { generateCode, parseModule } from 'magicast'

/**
 * Root-relative ids of every token module in the project (registry keys).
 *
 * A token module is a file whose default export is plain data: `motion.ts`
 * and `*.motion.ts` (motion tokens, per page and per transition) and the root
 * `type.ts` (the type system). Same shape, same AST-preserving writeback — the
 * only difference is which registry the running page keeps them in.
 */
export function scanMotionFiles(root) {
  const files = []
  if (fs.existsSync(path.join(root, 'motion.ts'))) files.push('/motion.ts')
  if (fs.existsSync(path.join(root, 'type.ts'))) files.push('/type.ts')
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
  // type.ts is the ROOT one only: a stray pages/x/type.ts is not a token
  // module, and writing to it would be writing to a file nothing reads.
  const isRootType = base === 'type.ts' && abs === path.join(root, 'type.ts')
  if (
    !abs.startsWith(root + path.sep) ||
    !(base === 'motion.ts' || base.endsWith('.motion.ts') || isRootType) ||
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
  if (!target) throw new Error('no default-exported motion({...}) or typography({...}) found')
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
