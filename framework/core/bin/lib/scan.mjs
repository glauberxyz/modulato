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

/**
 * Route id → transition filename form: `/` becomes `-`, param brackets drop.
 * `work/[slug]` → `work-slug`, so home → work/[slug] is `home__work-slug.ts`.
 */
export function slugRouteId(id) {
  return id.replaceAll('/', '-').replaceAll(/[[\]]/g, '')
}

/** Legacy filename encoding (dots for `/`, brackets kept). Still accepted. */
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

/**
 * Scan transitions/ for pair files, resolving each side against the real
 * route ids (dash form first, then the legacy dot/bracket encoding — those
 * entries get `legacy: true` so check can suggest the rename). Malformed
 * names are reported, not skipped.
 */
export function scanTransitions(root, transitionsDir = 'transitions') {
  const base = path.resolve(root, transitionsDir)
  const entries = []
  if (!fs.existsSync(base)) return entries
  const bySlug = new Map()
  const byLegacy = new Map()
  for (const route of scanRoutes(root)) {
    bySlug.set(slugRouteId(route.id), route.id)
    byLegacy.set(encodeRouteId(route.id), route.id)
  }
  const resolve = (name) => {
    if (bySlug.has(name)) return { id: bySlug.get(name), legacy: false }
    if (byLegacy.has(name)) return { id: byLegacy.get(name), legacy: name !== slugRouteId(byLegacy.get(name)) }
    return { id: decodeRouteId(name), legacy: false }
  }
  for (const file of fs.readdirSync(base)) {
    if (!file.endsWith('.ts')) continue
    // Colocated token modules for pair files, not transitions themselves.
    if (file.endsWith('.motion.ts')) continue
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
    const from = resolve(parts[0])
    const to = resolve(parts[1])
    entries.push({ file, from: from.id, to: to.id, legacy: from.legacy || to.legacy })
  }
  return entries
}
