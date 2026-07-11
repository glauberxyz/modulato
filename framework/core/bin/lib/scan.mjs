import fs from 'node:fs'
import path from 'node:path'

/** `work/[slug]` → `/work/:slug`, `home` → `/`. */
export function toPattern(id) {
  if (id === 'home') return '/'
  return (
    '/' +
    id
      .split('/')
      .map((seg) =>
        seg.startsWith('[') && seg.endsWith(']') ? `:${seg.slice(1, -1)}` : seg,
      )
      .join('/')
  )
}

/** Route ids ↔ transition filenames: `/` is encoded as `.`. */
export function encodeRouteId(id) {
  return id.replaceAll('/', '.')
}

export function decodeRouteId(encoded) {
  return encoded.replaceAll('.', '/')
}

/**
 * Scan pages/ for page folders — the same walk the Vite plugin does, so the
 * CLI and the runtime always agree on what a route is.
 */
export function scanRoutes(root, pagesDir = 'pages') {
  const base = path.resolve(root, pagesDir)
  const routes = []
  const walk = (dir, prefix) => {
    if (!fs.existsSync(dir)) return
    for (const dirent of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!dirent.isDirectory()) continue
      const id = prefix ? `${prefix}/${dirent.name}` : dirent.name
      const abs = path.join(dir, dirent.name)
      if (fs.existsSync(path.join(abs, 'page.tsx'))) {
        routes.push({
          id,
          pattern: toPattern(id),
          dir: abs,
          hasConfig: fs.existsSync(path.join(abs, 'config.ts')),
          hasIntro: fs.existsSync(path.join(abs, 'intro.ts')),
          hasStyles: fs.existsSync(path.join(abs, 'styles.scss')),
        })
      }
      walk(abs, id)
    }
  }
  walk(base, '')
  return routes
}

/** Scan transitions/ for pair files. Malformed names are reported, not skipped. */
export function scanTransitions(root, transitionsDir = 'transitions') {
  const base = path.resolve(root, transitionsDir)
  const entries = []
  if (!fs.existsSync(base)) return entries
  for (const file of fs.readdirSync(base)) {
    if (!file.endsWith('.ts')) continue
    const name = file.slice(0, -3)
    if (name === 'default') {
      entries.push({ file, isDefault: true })
      continue
    }
    const parts = name.split('__')
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      entries.push({ file, malformed: true })
      continue
    }
    entries.push({ file, from: decodeRouteId(parts[0]), to: decodeRouteId(parts[1]) })
  }
  return entries
}
