#!/usr/bin/env node
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { check } from './lib/check.mjs'
import { scanRoutes } from './lib/scan.mjs'
import {
  newBehavior,
  newIntro,
  newPage,
  newTransition,
  ScaffoldError,
} from './lib/scaffold.mjs'

const HELP = `modulato — the animation-first React framework

Usage
  modulato dev                          start the dev server (SSR + HMR)
  modulato build                        production build (client + ssr passes)

  modulato new page <route>             scaffold pages/<route>/ (page, config, styles)
                                          e.g. modulato new page archive/[slug]
  modulato new transition <from> <to>   scaffold transitions/<from>__<to>.ts
                                          --symmetric  also run in reverse
  modulato new behavior <name>          scaffold behaviors/<name>.ts (enhancer)
  modulato new intro [route]            page intro; omit <route> for the shell intro

  modulato routes [--json]              list routes derived from pages/
  modulato check [--json]               validate contracts (exit 1 on errors)

Conventions
  A page is a folder in pages/ with a page.tsx — no registration anywhere.
  Edit files directly; scaffold with "new" for exact naming; always finish
  with "modulato check".
`

const cwd = process.cwd()
const [, , command, ...rest] = process.argv
const flags = new Set(rest.filter((a) => a.startsWith('--')))
const args = rest.filter((a) => !a.startsWith('--'))
const json = flags.has('--json')

function out(value) {
  console.log(typeof value === 'string' ? value : JSON.stringify(value, null, 2))
}

function viteBin() {
  const require = createRequire(path.join(cwd, 'package.json'))
  try {
    // vite's exports map hides bin/vite.js — go through its package.json.
    const pkgPath = require.resolve('vite/package.json')
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
    const bin = typeof pkg.bin === 'string' ? pkg.bin : pkg.bin.vite
    return path.join(path.dirname(pkgPath), bin)
  } catch {
    console.error('[modulato] vite is not installed in this project (npm i -D vite)')
    process.exit(1)
  }
}

function runVite(viteArgs) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [viteBin(), ...viteArgs], { stdio: 'inherit' })
    child.on('exit', (code) => {
      if (code !== 0) process.exit(code ?? 1)
      resolve()
    })
  })
}

function reportScaffold({ created, note }) {
  if (json) return out({ ok: true, created, note })
  for (const file of created) console.log(`  created ${file}`)
  if (note) console.log(`\n${note}`)
}

try {
  switch (command) {
    case 'dev':
      await runVite(rest)
      break

    case 'build':
      await runVite(['build', ...rest])
      await runVite(['build', '--ssr', ...rest])
      break

    case 'new': {
      const [kind, ...params] = args
      if (kind === 'page' && params[0]) reportScaffold(newPage(cwd, params[0]))
      else if (kind === 'transition' && params[0] && params[1])
        reportScaffold(
          newTransition(cwd, params[0], params[1], { symmetric: flags.has('--symmetric') }),
        )
      else if (kind === 'behavior' && params[0]) reportScaffold(newBehavior(cwd, params[0]))
      else if (kind === 'intro') reportScaffold(newIntro(cwd, params[0]))
      else {
        console.error(HELP)
        process.exit(1)
      }
      break
    }

    case 'routes': {
      const routes = scanRoutes(cwd)
      if (json) {
        out(routes.map(({ dir: _dir, ...route }) => route))
        break
      }
      if (!routes.length) {
        console.log('no routes — create one: modulato new page home')
        break
      }
      const width = Math.max(...routes.map((r) => r.id.length), 5)
      const pWidth = Math.max(...routes.map((r) => r.pattern.length), 7)
      console.log(`${'route'.padEnd(width)}  ${'pattern'.padEnd(pWidth)}  config intro styles`)
      for (const r of routes)
        console.log(
          `${r.id.padEnd(width)}  ${r.pattern.padEnd(pWidth)}  ${r.hasConfig ? '  ✓   ' : '  ·   '}${r.hasIntro ? '  ✓  ' : '  ·  '}${r.hasStyles ? '  ✓' : '  ·'}`,
        )
      break
    }

    case 'check': {
      const result = check(cwd)
      if (json) {
        out(result)
        process.exit(result.ok ? 0 : 1)
      }
      for (const e of result.errors) console.error(`✖ ${e.file}: ${e.message}`)
      for (const w of result.warnings) console.warn(`⚠ ${w.file}: ${w.message}`)
      if (result.ok)
        console.log(
          `✓ contracts hold (${scanRoutes(cwd).length} routes${result.warnings.length ? `, ${result.warnings.length} warning(s)` : ''})`,
        )
      process.exit(result.ok ? 0 : 1)
      break
    }

    case '--version':
    case '-v': {
      const pkg = JSON.parse(
        fs.readFileSync(
          path.join(path.dirname(fileURLToPath(import.meta.url)), '../package.json'),
          'utf8',
        ),
      )
      console.log(pkg.version)
      break
    }

    default:
      console.log(HELP)
      process.exit(command && command !== 'help' && command !== '--help' ? 1 : 0)
  }
} catch (err) {
  if (err instanceof ScaffoldError) {
    if (json) out({ ok: false, error: err.message })
    else console.error(`✖ ${err.message}`)
    process.exit(1)
  }
  throw err
}
