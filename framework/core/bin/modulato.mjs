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

  modulato content [--json]             pull the content source → typed snapshot
                                          (.modulato/content.json + content.d.ts)
  modulato routes [--json]              list routes derived from pages/
  modulato tokens [filter] [--json]     motion tokens from every motion.ts
  modulato check [--json]               validate contracts (exit 1 on errors)

Conventions
  A page is a folder in pages/ with a page.tsx — no registration anywhere.
  Edit files directly; scaffold with "new" for exact naming; always finish
  with "modulato check".

Agent notes
  Every command is non-interactive: no prompts, no menus, args only.
  Add --json anywhere for machine-readable output on stdout.
  Scaffolds are atomic — on any conflict they fail and create NOTHING.
  Exit codes: 0 ok, 1 error. "modulato dev" runs until killed
  (background it) and honors the PORT env var (portless/PaaS);
  "modulato build" exits when done.
`

const cwd = process.cwd()
const [, , command, ...rest] = process.argv
const flags = new Set(rest.filter((a) => a.startsWith('--')))
const args = rest.filter((a) => !a.startsWith('--'))
const json = flags.has('--json')

// Guard against the classic agent mistake: running from a parent directory
// (monorepo root) and silently operating on the wrong tree.
function isModulatoProject(dir) {
  if (fs.existsSync(path.join(dir, 'pages'))) return true
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'))
    return Boolean(pkg.dependencies?.modulato ?? pkg.devDependencies?.modulato)
  } catch {
    return false
  }
}

if (
  ['dev', 'build', 'new', 'routes', 'tokens', 'check', 'content'].includes(command) &&
  !isModulatoProject(cwd)
) {
  const message = `${cwd} doesn't look like a Modulato site (no pages/ directory, no "modulato" in package.json) — run from the site root.`
  if (json) console.log(JSON.stringify({ ok: false, error: message }))
  else console.error(`✖ ${message}`)
  process.exit(1)
}

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
    case 'dev': {
      const devArgs = [...rest]
      // Port managers (portless) and PaaS previews hand us the port via env.
      if (process.env.PORT && !rest.includes('--port')) {
        devArgs.push('--port', process.env.PORT, '--strictPort')
        // Proxies dial IPv4; vite's default 'localhost' may bind ::1 only.
        if (!rest.includes('--host')) {
          devArgs.push('--host', process.env.HOST ?? '127.0.0.1')
        }
      }
      await runVite(devArgs)
      break
    }

    case 'build':
      await runVite(['build', ...rest])
      await runVite(['build', '--ssr', ...rest])
      break

    case 'new': {
      const [kind, ...params] = args
      const usage = {
        page: 'modulato new page <route>            e.g. modulato new page archive/[slug]',
        transition:
          'modulato new transition <from> <to> [--symmetric]   route ids, e.g. modulato new transition home about',
        behavior: 'modulato new behavior <name>         e.g. modulato new behavior parallax',
        intro: 'modulato new intro [route]           omit <route> for the shell intro',
      }
      if (kind === 'page' && params[0]) reportScaffold(newPage(cwd, params[0]))
      else if (kind === 'transition' && params[0] && params[1])
        reportScaffold(
          newTransition(cwd, params[0], params[1], { symmetric: flags.has('--symmetric') }),
        )
      else if (kind === 'behavior' && params[0]) reportScaffold(newBehavior(cwd, params[0]))
      else if (kind === 'intro') reportScaffold(newIntro(cwd, params[0]))
      else {
        const message = usage[kind]
          ? `missing arguments — usage: ${usage[kind]}`
          : `unknown scaffold "${kind ?? ''}" — one of: page, transition, behavior, intro`
        if (json) out({ ok: false, error: message })
        else console.error(`✖ ${message}`)
        process.exit(1)
      }
      break
    }

    case 'content': {
      const { pullContent } = await import('./lib/content.mjs')
      try {
        const result = await pullContent(cwd)
        if (json) out({ ok: true, ...result })
        else
          console.log(
            `✓ pulled "${result.adapter}" → ${result.files.join(', ')} (keys: ${result.keys.join(', ') || 'none'})`,
          )
      } catch (error) {
        const message = String(error?.message ?? error)
        if (json) out({ ok: false, error: message })
        else console.error(`✖ ${message}`)
        process.exit(1)
      }
      break
    }

    case 'tokens': {
      let tokensLib
      try {
        tokensLib = await import('@modulato/tweak/tokens')
      } catch {
        const message =
          'modulato tokens needs @modulato/tweak installed (npm i -D @modulato/tweak)'
        if (json) out({ ok: false, error: message })
        else console.error(`✖ ${message}`)
        process.exit(1)
      }
      const filter = args[0]
      const files = tokensLib
        .scanMotionFiles(cwd)
        .filter((file) => !filter || file.includes(filter))
      const data = files.map((file) => ({ file, tokens: tokensLib.readTokens(cwd, file) }))
      if (json) {
        out(data)
        break
      }
      if (!data.length) {
        console.log(
          filter
            ? `no motion.ts matches "${filter}"`
            : 'no motion.ts files — colocate one with a page to make its numbers tweakable',
        )
        break
      }
      for (const { file, tokens } of data) {
        console.log(file)
        const walk = (node, prefix) => {
          for (const [key, value] of Object.entries(node)) {
            if (value && typeof value === 'object' && !Array.isArray(value))
              walk(value, `${prefix}${key}.`)
            else console.log(`  ${prefix}${key} = ${JSON.stringify(value)}`)
          }
        }
        walk(tokens, '')
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
