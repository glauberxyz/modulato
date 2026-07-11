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
