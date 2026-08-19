import fs from 'node:fs'
import path from 'node:path'

/**
 * Local JSON content: every `<dir>/*.json` becomes a top-level snapshot key
 * named after the file — content/projects.json → content.projects. The
 * simplest adapter, and the reference for writing new ones: an adapter is
 * just `{ name, pull({ root }) => snapshot object }`.
 *
 *   // modulato.config.ts
 *   export default defineConfig({ content: localJson({ dir: 'content' }) })
 */
export function localJson({ dir = 'content' } = {}) {
  return {
    name: 'local-json',
    async pull({ root }) {
      const base = path.resolve(root, dir)
      if (!fs.existsSync(base))
        throw new Error(`content directory not found: ${dir}/ (looked in ${base})`)
      const snapshot = {}
      for (const file of fs.readdirSync(base).sort()) {
        if (!file.endsWith('.json')) continue
        const key = file.slice(0, -5)
        try {
          snapshot[key] = JSON.parse(fs.readFileSync(path.join(base, file), 'utf8'))
        } catch (error) {
          throw new Error(`invalid JSON in ${dir}/${file}: ${error.message}`)
        }
      }
      return snapshot
    },
  }
}
