import fs from 'node:fs'
import path from 'node:path'
import { scanRoutes, slugRouteId, toPattern } from './scan.mjs'

const SEGMENT = /^([a-z0-9-]+|\[[a-z0-9-]+\])$/

class ScaffoldError extends Error {}

function fail(message) {
  throw new ScaffoldError(message)
}

function validateRouteId(routeId) {
  const segments = routeId.split('/')
  if (!segments.every((seg) => SEGMENT.test(seg)))
    fail(
      `invalid route "${routeId}" — segments are lowercase [a-z0-9-], params in brackets: archive/[slug]`,
    )
  return segments
}

/** `archive/[slug]` → `archive-slug` (root class), `ArchiveSlug` (component). */
function names(routeId) {
  const clean = routeId
    .split('/')
    .map((seg) => (seg.startsWith('[') ? seg.slice(1, -1) : seg))
  const className = clean.join('-')
  const component = clean
    .flatMap((seg) => seg.split('-'))
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join('')
  const title = className[0].toUpperCase() + className.slice(1).replaceAll('-', ' ')
  return { className, component, title }
}

/**
 * Scaffolds are ATOMIC: every target path is checked before anything is
 * written, so a failed scaffold changes nothing — agents can retry with a
 * different name without cleaning up partial output first.
 */
function write(root, relPath, content, queued) {
  queued.push({ relPath, content })
}

function commit(root, queued) {
  for (const { relPath } of queued) {
    if (fs.existsSync(path.resolve(root, relPath)))
      fail(`${relPath} already exists — refusing to overwrite (nothing was created)`)
  }
  for (const { relPath, content } of queued) {
    const abs = path.resolve(root, relPath)
    fs.mkdirSync(path.dirname(abs), { recursive: true })
    fs.writeFileSync(abs, content)
  }
  return queued.map(({ relPath }) => relPath)
}

export function newPage(root, routeId) {
  validateRouteId(routeId)
  const { className, component, title } = names(routeId)
  const params = routeId
    .split('/')
    .filter((seg) => seg.startsWith('['))
    .map((seg) => seg.slice(1, -1))
  const created = []

  write(
    root,
    `pages/${routeId}/page.tsx`,
    `export default function ${component}() {
  return (
    <main className="${className}">
      <h1 className="${className}__title">${title}</h1>
    </main>
  )
}
`,
    created,
  )

  write(
    root,
    `pages/${routeId}/config.ts`,
    `export function meta() {
  return {
    title: '${title}',
  }
}
${
  params.length
    ? `
// Load data for this page — runs server-side on first paint, and for client
// navigations before the transition starts. Returned props are passed to the
// page component.
// export function load({ params }: { params: { ${params.map((p) => `${p}: string`).join('; ')} } }) {
//   return {}
// }
`
    : `
// export function load() {
//   return {}
// }
`
}`,
    created,
  )

  write(
    root,
    `pages/${routeId}/styles.scss`,
    `.${className} {
  padding: 10rem 6vw 6rem;

  &__title {
    margin: 0;
  }
}
`,
    created,
  )

  return {
    created: commit(root, created),
    note: `route ${toPattern(routeId)} is live (no registration needed). Link to it with <a href="${toPattern(routeId)}">. Finish with: modulato check`,
  }
}

export function newTransition(root, from, to, { symmetric = false } = {}) {
  const routes = scanRoutes(root)
  const known = routes.map((r) => r.id)
  for (const id of [from, to]) {
    if (!known.includes(id))
      fail(
        `"${id}" is not a page. Known routes: ${known.join(', ') || '(none)'}. Create it first: modulato new page ${id}`,
      )
  }
  const file = `transitions/${slugRouteId(from)}__${slugRouteId(to)}.ts`
  const created = []
  write(
    root,
    file,
    `import { transition } from 'modulato'

/**
 * ${from} → ${to}${symmetric ? ' (and back — symmetric)' : ''}.
 * Both pages are mounted when run() is called: the outgoing page is lifted
 * into an overlay, the incoming page sits underneath at its final scroll.
 * \`shared\` holds matched <Shared> pairs, pre-measured — see flipShared().
 */
export default transition({
  symmetric: ${symmetric},
  async run({ from, to }) {
    await Promise.all([
      from.element.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: 400,
        easing: 'ease',
        fill: 'forwards',
      }).finished,
      to.element.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: 400,
        easing: 'ease',
        fill: 'forwards',
      }).finished,
    ]).catch(() => {})
  },
})
`,
    created,
  )
  return {
    created: commit(root, created),
    note: `runs on ${from} → ${to}${symmetric ? ` and ${to} → ${from}` : ''}. Finish with: modulato check`,
  }
}

export function newBehavior(root, name) {
  if (!/^[a-z0-9-]+$/.test(name))
    fail(`invalid behavior name "${name}" — use lowercase [a-z0-9-]`)
  const created = []
  write(
    root,
    `behaviors/${name}.ts`,
    `import { enhance } from 'modulato'

/**
 * Applied to every [data-${name}] node inside a page when it mounts;
 * the returned cleanup runs when the page unmounts.
 */
export default enhance('[data-${name}]', ({ element, data, page }) => {
  // element: the matched node · data: its data-* attributes · page: { element, route }

  return () => {
    // cleanup
  }
})
`,
    created,
  )
  return {
    created: commit(root, created),
    note: `auto-discovered — applies to [data-${name}] nodes on every page.`,
  }
}

export function newIntro(root, routeId) {
  const created = []
  if (!routeId) {
    write(
      root,
      'intro.ts',
      `import { intro } from 'modulato'

/**
 * Shell intro — first-load choreography for the PERSISTENT elements
 * (everything outside <PageOutlet/>). Runs alongside the page's own intro;
 * the app stays hidden until both are ready to start.
 */
export default intro({
  async run({ element }) {
    await element
      .animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: 500,
        easing: 'ease',
        fill: 'backwards',
      })
      .finished.catch(() => {})
  },
})
`,
      created,
    )
    return {
      created: commit(root, created),
      note: 'runs on first load, choreographing the persistent shell.',
    }
  }

  const routes = scanRoutes(root)
  if (!routes.some((r) => r.id === routeId))
    fail(
      `"${routeId}" is not a page. Known routes: ${routes.map((r) => r.id).join(', ') || '(none)'}`,
    )
  write(
    root,
    `pages/${routeId}/intro.ts`,
    `import { intro } from 'modulato'

/**
 * First-load intro for ${toPattern(routeId)} — runs after fonts are ready,
 * only on initial load (navigations use transitions/ instead).
 */
export default intro({
  async run({ element }) {
    await element
      .animate([{ opacity: 0, transform: 'translateY(24px)' }, { opacity: 1, transform: 'none' }], {
        duration: 700,
        easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
        fill: 'backwards',
      })
      .finished.catch(() => {})
  },
})
`,
    created,
  )
  return {
    created: commit(root, created),
    note: `replaces the default fade-in on first loads of ${toPattern(routeId)}.`,
  }
}

export { ScaffoldError }
