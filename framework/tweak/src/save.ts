import type { TokenLeaf } from 'modulato'

/**
 * Write pending token edits back into their source file.
 *
 * One endpoint for every token module — a page's motion.ts, a transition's
 * .motion.ts, the project's type.ts — because they are the same thing: a
 * default-exported literal that the server edits with an AST-preserving write
 * (magicast/recast), so comments and formatting survive.
 *
 * Throws with the server's own sentence, which is the one worth showing.
 */
export async function saveTokens(file: string, changes: TokenLeaf[]): Promise<void> {
  const res = await fetch('/__modulato/tokens', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ file, changes }),
  })
  const body = (await res.json()) as { ok: boolean; error?: string }
  if (!body.ok) throw new Error(body.error ?? `HTTP ${res.status}`)
}

/**
 * Open the file:line an element's `data-modulato-source` names, in the
 * editor. Shared with Inspect mode — see the note on `openMiddleware` for why
 * this is two requests and not one.
 */
export async function openInEditor(at: string): Promise<void> {
  const res = await fetch(`/__modulato/open?at=${encodeURIComponent(at)}`)
  const body = (await res.json()) as { ok: boolean; file?: string; error?: string }
  if (!body.ok || !body.file) throw new Error(body.error ?? `HTTP ${res.status}`)
  await fetch(`/__open-in-editor?file=${encodeURIComponent(body.file)}`)
}
