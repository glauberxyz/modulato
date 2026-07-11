// Shared token-file operations: the writeback middleware and @modulato/mcp
// both go through here, so a human in the overlay and an agent over MCP are
// editing files with identical semantics.
import fs from 'node:fs'
import path from 'node:path'
import { generateCode, parseModule } from 'magicast'

/** Root-relative ids of every motion.ts in the project (registry keys). */
export function scanMotionFiles(root) {
  const files = []
  if (fs.existsSync(path.join(root, 'motion.ts'))) files.push('/motion.ts')
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

/** Validate a root-relative motion.ts id and return its absolute path. */
export function resolveMotionFile(root, file) {
  if (typeof file !== 'string') throw new Error('file must be a string')
  const abs = path.resolve(root, `.${path.sep}${file.replace(/^\//, '')}`)
  const base = path.basename(abs)
  if (
    !abs.startsWith(root + path.sep) ||
    (base !== 'motion.ts' && !base.endsWith('.motion.ts')) ||
    !fs.existsSync(abs)
  )
    throw new Error(`not a motion.ts in this project: ${file}`)
  return abs
}

function unwrap(mod) {
  let target = mod.exports.default
  if (target && target.$type === 'function-call') target = target.$args[0]
  if (!target) throw new Error('no default-exported motion({...}) found')
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
  const mod = parseModule(fs.readFileSync(abs, 'utf8'))
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
    let node = target
    for (const key of tokenPath.slice(0, -1)) {
      node = node?.[key]
    }
    if (!node || typeof node !== 'object') continue
    node[tokenPath[tokenPath.length - 1]] = value
    applied.push(tokenPath.join('.'))
  }

  fs.writeFileSync(abs, generateCode(mod).code)
  return applied
}
