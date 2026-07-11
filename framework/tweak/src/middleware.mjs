import fs from 'node:fs'
import path from 'node:path'
import { generateCode, parseModule } from 'magicast'

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
      if (typeof file !== 'string' || !Array.isArray(changes))
        return send(res, 400, { ok: false, error: 'expected { file, changes[] }' })

      // Only registered token modules are writable: motion.ts inside the root.
      const abs = path.resolve(root, `.${path.sep}${file.replace(/^\//, '')}`)
      if (
        !abs.startsWith(root + path.sep) ||
        path.basename(abs) !== 'motion.ts' ||
        !fs.existsSync(abs)
      )
        return send(res, 400, { ok: false, error: `not a writable motion.ts: ${file}` })

      const mod = parseModule(fs.readFileSync(abs, 'utf8'))
      let target = mod.exports.default
      // Unwrap the motion({...}) call.
      if (target && target.$type === 'function-call') target = target.$args[0]
      if (!target)
        return send(res, 400, { ok: false, error: 'no default export object found' })

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
      send(res, 200, { ok: true, applied })
    } catch (error) {
      send(res, 500, { ok: false, error: String(error?.message ?? error) })
    }
  }
}
