#!/usr/bin/env node
// MCP server for a Modulato project. Run from the project root:
//   claude mcp add modulato -- npx modulato-mcp
//
// Static tools (routes, check, scaffolds, token files) work on the file
// system; live tools (replay, speed) relay through the dev server, and token
// WRITES land in motion.ts where the dev server's HMR merge applies them to
// the running page — a file edit IS a live edit.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { check, newBehavior, newIntro, newPage, newTransition, scanRoutes } from 'modulato/cli'
import { readTokens, scanMotionFiles, writeTokens } from '@modulato/tweak/tokens'

const root = process.cwd()
const devServer = process.env.MODULATO_DEV_SERVER ?? 'http://localhost:5173'

const server = new McpServer({ name: 'modulato', version: '0.0.1' })

const asText = (value) => ({
  content: [{ type: 'text', text: JSON.stringify(value, null, 2) }],
})
const asError = (error) => ({
  content: [{ type: 'text', text: JSON.stringify({ ok: false, error: String(error?.message ?? error) }) }],
  isError: true,
})
const run = (fn) => async (args) => {
  try {
    return asText(await fn(args ?? {}))
  } catch (error) {
    return asError(error)
  }
}

async function relay(data) {
  const res = await fetch(`${devServer}/__modulato/replay`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(data),
  }).catch(() => null)
  if (!res?.ok)
    throw new Error(
      `dev server not reachable at ${devServer} — start it (modulato dev) or set MODULATO_DEV_SERVER`,
    )
  return { ok: true, ...data }
}

server.registerTool(
  'list_routes',
  {
    description:
      'List the project routes derived from pages/ (a page is a folder with page.tsx — no registration).',
    inputSchema: {},
  },
  run(() => scanRoutes(root).map(({ dir: _dir, ...route }) => route)),
)

server.registerTool(
  'check',
  {
    description:
      'Validate the project contracts (orphan files, dangling transitions, missing exports). Run after every edit, like a type-checker.',
    inputSchema: {},
  },
  run(() => check(root)),
)

server.registerTool(
  'scaffold_page',
  {
    description:
      'Scaffold pages/<route>/ (page.tsx, config.ts, styles.scss) with every naming convention derived from the route id. Params in brackets: archive/[slug].',
    inputSchema: { route: z.string() },
  },
  run(({ route }) => newPage(root, route)),
)

server.registerTool(
  'scaffold_transition',
  {
    description:
      'Scaffold a transition pair file for from → to (route ids). symmetric also runs it in reverse.',
    inputSchema: { from: z.string(), to: z.string(), symmetric: z.boolean().optional() },
  },
  run(({ from, to, symmetric }) => newTransition(root, from, to, { symmetric })),
)

server.registerTool(
  'scaffold_behavior',
  {
    description: 'Scaffold behaviors/<name>.ts — an enhancer applied to [data-<name>] nodes on every page.',
    inputSchema: { name: z.string() },
  },
  run(({ name }) => newBehavior(root, name)),
)

server.registerTool(
  'scaffold_intro',
  {
    description:
      'Scaffold a first-load intro: pages/<route>/intro.ts, or the shell intro (root intro.ts) when route is omitted.',
    inputSchema: { route: z.string().optional() },
  },
  run(({ route }) => newIntro(root, route)),
)

server.registerTool(
  'list_motion_tokens',
  {
    description:
      'Read every motion.ts token module (file → token tree). Tokens are the tweakable numbers of the site’s animations.',
    inputSchema: {},
  },
  run(() =>
    scanMotionFiles(root).map((file) => ({ file, tokens: readTokens(root, file) })),
  ),
)

server.registerTool(
  'set_motion_tokens',
  {
    description:
      'Set token values in a motion.ts (AST-preserving file edit). With the dev server running, values apply to the page live via HMR — follow with replay to see them.',
    inputSchema: {
      file: z.string().describe('root-relative, e.g. /pages/home/motion.ts'),
      changes: z.array(
        z.object({
          path: z.array(z.string()).describe('e.g. ["intro","headline","duration"]'),
          value: z.union([z.number(), z.string(), z.boolean()]),
        }),
      ),
    },
  },
  run(({ file, changes }) => ({ ok: true, applied: writeTokens(root, file, changes) })),
)

server.registerTool(
  'replay',
  {
    description:
      "Replay animations in the running dev-server page: 'intro' (current page intro), 'shell' (persistent shell intro), or 'motions' (all useMotion hooks).",
    inputSchema: { target: z.enum(['intro', 'shell', 'motions']) },
  },
  run(({ target }) => relay({ target })),
)

server.registerTool(
  'set_speed',
  {
    description: 'Set global animation playback speed in the running page (1 = normal, 0.1 = slow-mo).',
    inputSchema: { value: z.number().min(0.01).max(4) },
  },
  run(({ value }) => relay({ target: 'speed', value })),
)

await server.connect(new StdioServerTransport())
