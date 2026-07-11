#!/usr/bin/env node
// create-modulato — scaffold a Modulato site.
//
//   npm create modulato@latest my-site
//   npx create-modulato my-site [--json]
//
// Non-interactive by design (agents are first-class users): one positional
// argument, no prompts, no side effects beyond writing the directory — no
// git init, no install. Conflicting targets fail before anything is written.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const TEMPLATE = path.join(HERE, 'templates/default')

const rest = process.argv.slice(2)
const json = rest.includes('--json')
const target = rest.find((a) => !a.startsWith('-'))

function fail(message) {
  if (json) console.log(JSON.stringify({ ok: false, error: message }))
  else console.error(`✖ ${message}`)
  process.exit(1)
}

if (!target) fail('usage: npm create modulato@latest <directory>')
if (!/^[a-z0-9-_.@/]+$/i.test(target)) fail(`invalid directory name "${target}"`)

const dest = path.resolve(process.cwd(), target)
const name = path
  .basename(dest)
  .toLowerCase()
  .replace(/[^a-z0-9-]+/g, '-')
  .replace(/^-+|-+$/g, '') || 'modulato-site'

if (fs.existsSync(dest) && fs.readdirSync(dest).length > 0)
  fail(`${target} exists and is not empty — nothing was created`)

// Copy the template. `gitignore` ships dotless (npm strips .gitignore from
// published tarballs) and is renamed on the way out.
const created = []
const walk = (from, to) => {
  fs.mkdirSync(to, { recursive: true })
  for (const dirent of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, dirent.name)
    const outName = dirent.name === 'gitignore' ? '.gitignore' : dirent.name
    const out = path.join(to, outName)
    if (dirent.isDirectory()) {
      walk(src, out)
    } else {
      let content = fs.readFileSync(src, 'utf8')
      if (dirent.name === 'package.json') content = content.replace('__NAME__', name)
      fs.writeFileSync(out, content)
      created.push(path.relative(dest, out))
    }
  }
}
walk(TEMPLATE, dest)

// The scaffolded project carries the full framework reference.
const reference = path.join(HERE, 'MODULATO.md')
if (fs.existsSync(reference)) {
  fs.copyFileSync(reference, path.join(dest, 'MODULATO.md'))
  created.push('MODULATO.md')
}

const next = [
  `cd ${target}`,
  'npm install',
  'npm run dev        # SSR + HMR on http://localhost:5173',
  'npx modulato check # validate after every structural edit',
]

if (json) {
  console.log(JSON.stringify({ ok: true, dir: target, name, files: created.length, next }))
} else {
  console.log(`✓ scaffolded ${target} (${created.length} files)\n`)
  for (const step of next) console.log(`  ${step}`)
  console.log(
    '\nMODULATO.md is the complete reference; CLAUDE.md points agents at it.\nTweak animations live: open the ✦ motion button in dev.',
  )
}
