#!/usr/bin/env node
// Regenerate the scaffold template's Modulato dependency ranges from the
// versions the workspace is actually at.
//
// Hand-maintained literals had gone six minors stale: the template pinned
// `^0.1.0` while core was 0.7.0, and on a 0.x line caret NEVER crosses a
// minor — so `npm create modulato` installed 0.1.7 and there was no version
// of the range that could ever reach 0.7.0. Worse, it was self-concealing:
// the scaffolded site worked, just as an old framework, so nobody looked.
//
//   node scripts/sync-template-deps.mjs           rewrite the template
//   node scripts/sync-template-deps.mjs --check   fail if it is out of date
//
// Wired into `changeset:version` (so the Version Packages PR carries the new
// ranges) and into CI's Check gate in --check mode (so drift can't land).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const TEMPLATE = path.join(ROOT, 'framework/create/templates/default/package.json')
const FRAMEWORK = path.join(ROOT, 'framework')

const check = process.argv.includes('--check')

/** Published version of every workspace package under framework/. */
const versions = new Map()
for (const dir of fs.readdirSync(FRAMEWORK)) {
  const manifest = path.join(FRAMEWORK, dir, 'package.json')
  if (!fs.existsSync(manifest)) continue
  const pkg = JSON.parse(fs.readFileSync(manifest, 'utf8'))
  if (pkg.private) continue
  versions.set(pkg.name, pkg.version)
}

const source = fs.readFileSync(TEMPLATE, 'utf8')
const template = JSON.parse(source)

const stale = []
for (const field of ['dependencies', 'devDependencies']) {
  for (const name of Object.keys(template[field] ?? {})) {
    const version = versions.get(name)
    if (!version) continue // third-party (react, gsap, vite) — not ours to pin
    const want = `^${version}`
    if (template[field][name] !== want)
      stale.push(`${name}: ${template[field][name]} → ${want}`)
    template[field][name] = want
  }
}

// Preserve the file's exact formatting: 2-space JSON + trailing newline, the
// shape npm itself writes, so the diff is only ever the versions.
const next = `${JSON.stringify(template, null, 2)}\n`

if (check) {
  if (next === source) {
    console.log('template deps in sync')
    process.exit(0)
  }
  console.error(
    `✖ framework/create/templates/default/package.json is out of date:\n` +
      stale.map((line) => `    ${line}`).join('\n') +
      `\n  Run: node scripts/sync-template-deps.mjs`,
  )
  process.exit(1)
}

if (next === source) {
  console.log('template deps already in sync')
} else {
  fs.writeFileSync(TEMPLATE, next)
  console.log(`updated template deps:\n${stale.map((line) => `  ${line}`).join('\n')}`)
}
