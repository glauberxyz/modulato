import fs from 'node:fs'
import path from 'node:path'
import { writeTokens } from './tokens.mjs'

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (chunk) => {
      data += chunk
      if (data.length > 1_000_000) reject(new Error('payload too large'))
    })
    req.on('end', () => resolve(data))
    req.on('error', reject)
  })
}

function send(res, status, body) {
  res.statusCode = status
  res.setHeader('content-type', 'application/json')
  res.end(JSON.stringify(body))
}

/**
 * POST { file: "/pages/home/motion.ts", changes: [{ path: ["intro","headline","duration"], value: 1.4 }] }
 *
 * Applies each change into the motion.ts source with an AST-preserving edit
 * (magicast/recast): comments, formatting and everything Tweak Mode doesn't
 * touch survive the write.
 */
export function tokensMiddleware(root) {
  return async (req, res, next) => {
    if (req.method !== 'POST') return next()
    try {
      const { file, changes } = JSON.parse(await readBody(req))
      const applied = writeTokens(root, file, changes)
      send(res, 200, { ok: true, applied })
    } catch (error) {
      send(res, 400, { ok: false, error: String(error?.message ?? error) })
    }
  }
}

/**
 * GET /__modulato/open?at=/pages/home/page.tsx:78
 *
 * Resolves a `data-modulato-source` value — which is ROOT-RELATIVE, as it
 * appears in the DOM — to an absolute path, and hands it back for the client
 * to pass to Vite's own `/__open-in-editor`.
 *
 * That indirection is not ceremony. Vite mounts launch-editor with no srcRoot,
 * so it resolves against `process.cwd()`, which in a monorepo is rarely the
 * Vite root; and our attribute's leading `/` would make `path.resolve` treat
 * it as already-absolute and look in the filesystem root. Passing an ABSOLUTE
 * path sidesteps both, because `path.resolve` returns it unchanged.
 *
 * The other half is that launch-editor does `if (!existsSync(f)) return` and
 * still answers 200 — a wrong path is a silent no-op with nothing to read.
 * Checking here means a miss comes back as a sentence instead of nothing
 * happening, which is the whole difference between a tool and a mystery.
 */
export function openMiddleware(root) {
  return async (req, res, next) => {
    if (req.method !== 'GET') return next()
    let at
    try {
      at = new URL(req.url, 'http://localhost').searchParams.get('at')
    } catch {
      return send(res, 400, { ok: false, error: 'malformed request url' })
    }
    if (!at) return send(res, 400, { ok: false, error: 'missing ?at=' })

    // Same shape launch-editor parses, so what we validate is what it opens.
    // The column is optional and normally absent: the attribute carries only
    // file:line, because Vite's client and SSR transforms disagree about the
    // column and the difference hydration-mismatched every page.
    const match = /^(.*?):(\d+)(?::(\d+))?$/.exec(at)
    if (!match)
      return send(res, 400, {
        ok: false,
        error: `not a file:line reference: ${at}`,
      })
    const [, file, line, column] = match

    const abs = path.resolve(root, file.replace(/^\/+/, ''))
    // The value normally comes from our own attribute, but the endpoint is
    // reachable by anything that can see the dev server — and `--host` puts
    // that on the LAN. Opening an arbitrary file in the developer's editor is
    // a small blast radius and a trivial guard, so guard it.
    if (abs !== root && !abs.startsWith(root + path.sep))
      return send(res, 403, { ok: false, error: 'path escapes the project root' })
    if (!fs.existsSync(abs))
      return send(res, 404, { ok: false, error: `no such file: ${file}` })

    send(res, 200, { ok: true, file: `${abs}:${line}:${column ?? 1}` })
  }
}
