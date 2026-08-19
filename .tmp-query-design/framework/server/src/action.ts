import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Action } from 'modulato'

export interface ActionEntry {
  id: string
  exportName: string
  load: () => Promise<Record<string, unknown>>
}

export interface ActionsManifest {
  entries: ActionEntry[]
}

export const ACTION_PREFIX = '/__modulato/action/'

function respondJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status
  res.setHeader('content-type', 'application/json')
  res.end(JSON.stringify(body))
}

/**
 * Run a server action against a Node request/response — used verbatim by the
 * dev middleware and the production function. Content negotiation:
 *   - fetch clients (accept: application/json) get { ok, data | error }
 *   - plain form posts (no JS) get a 303 back to the referer, or to
 *     `data.redirect` when the handler returns one — the PRG pattern.
 */
export async function nodeAction({
  actions,
  req,
  res,
}: {
  actions: ActionsManifest
  req: IncomingMessage
  res: ServerResponse
}): Promise<void> {
  const wantsJson = (req.headers.accept ?? '').includes('application/json')
  const pathname = new URL(req.url ?? '/', 'http://modulato.internal').pathname
  const id = decodeURIComponent(pathname.slice(ACTION_PREFIX.length))

  const entry = actions.entries.find((e) => e.id === id)
  if (!entry) return respondJson(res, 404, { ok: false, error: `unknown action "${id}"` })

  let def: Action | undefined
  try {
    const mod = await entry.load()
    def = mod[entry.exportName] as Action | undefined
  } catch (error) {
    console.error(`[modulato] failed to load action module for "${id}"`, error)
  }
  if (!def?.$action || typeof def.handler !== 'function')
    return respondJson(res, 404, {
      ok: false,
      error: `"${entry.exportName}" is not an action() export`,
    })

  // Parse the body through the web FormData machinery (urlencoded/multipart).
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  const headers = new Headers()
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === 'string') headers.set(key, value)
  }
  let form: FormData
  try {
    form = await new Request('http://modulato.internal', {
      method: 'POST',
      headers,
      body: Buffer.concat(chunks),
    }).formData()
  } catch {
    return respondJson(res, 400, { ok: false, error: 'could not parse form data' })
  }

  try {
    const data = (await def.handler({ form })) as { redirect?: string } | undefined
    if (wantsJson) return respondJson(res, 200, { ok: true, data: data ?? null })
    res.statusCode = 303
    res.setHeader('location', data?.redirect ?? req.headers.referer ?? '/')
    res.end()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (wantsJson) return respondJson(res, 400, { ok: false, error: message })
    res.statusCode = 303
    res.setHeader('location', req.headers.referer ?? '/')
    res.end()
  }
}
