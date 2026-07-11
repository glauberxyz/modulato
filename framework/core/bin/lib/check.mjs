import fs from 'node:fs'
import path from 'node:path'
import { encodeRouteId, scanRoutes, scanTransitions } from './scan.mjs'

const COMPANIONS = ['styles.scss', 'config.ts', 'intro.ts']

/**
 * Validate the project's contracts. Every message says how to fix the
 * problem — errors teach, they don't just point.
 */
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

  // Transition pair files must reference existing routes.
  const known = routes.map((r) => r.id)
  for (const entry of scanTransitions(root)) {
    if (entry.isDefault) continue
    if (entry.malformed) {
      error(
        `transitions/${entry.file}`,
        `malformed name — expected <from>__<to>.ts (double underscore), where "/" in a route id is written as ".": e.g. ${
          known[1] ? `${encodeRouteId(known[0])}__${encodeRouteId(known[1])}.ts` : 'home__about.ts'
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

  return { ok: errors.length === 0, errors, warnings }
}
