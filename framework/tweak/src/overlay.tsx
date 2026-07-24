import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import type { ModulatoDevHandle } from 'modulato/client'
import type { TokenLeaf, TokenValue } from 'modulato'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Slider } from './ui/slider'
import { Switch } from './ui/switch'
import { Separator } from './ui/separator'
import { cn } from './ui/utils'
import css from './overlay.css?inline'
// Inter variable (latin subset, OFL — see inter-license.txt), vendored from
// @fontsource-variable/inter@5.3.0. Bundled so the overlay renders Inter even
// on machines without it installed (or with only stray weights installed).
import interUrl from './inter.woff2'

function useHandle(): ModulatoDevHandle | null {
  const [handle, setHandle] = useState<ModulatoDevHandle | null>(
    () => window.__MODULATO__ ?? null,
  )
  useEffect(() => {
    if (handle) return undefined
    const timer = setInterval(() => {
      if (window.__MODULATO__) {
        setHandle(window.__MODULATO__)
        clearInterval(timer)
      }
    }, 100)
    return () => clearInterval(timer)
  }, [handle])
  return handle
}

const fmt = (v: number) => String(parseFloat(v.toFixed(4)))

/** Slider bounds from the value the session started at: 0..2x for positives
 * (symmetric for negatives/zero), a power-of-ten step. The number box takes
 * exact/out-of-range values — the slider stretches to include them. */
function sliderRange(initial: number) {
  const magnitude = Math.max(Math.abs(initial), 0.5)
  const min = initial < 0 || initial === 0 ? -2 * magnitude : 0
  const max = 2 * magnitude
  const step = Math.pow(10, Math.floor(Math.log10((max - min) / 200)))
  return { min, max, step }
}

// Ease catalogs. Modulato animates through TWO backends and their easing
// vocabularies don't mix: GSAP motions take ease NAMES ('expo.out'), while
// transitions run on WAAPI/CSS, which takes CSS easings ('ease-out',
// 'cubic-bezier(…)') — feeding a GSAP name to element.animate() throws and the
// transition never plays. The control detects the flavor from the field's
// value and offers the matching catalog; for CSS it lists the standard curves
// AS valid cubic-beziers, labeled with their familiar names. A value outside
// either catalog (project CustomEase) is kept as its own option. Next step
// (designed, not built): custom curves declared in modulato.config —
// tailwind.config-style extend — surfaced here by name.
const EASE_FAMILIES = ['power1', 'power2', 'power3', 'power4', 'sine', 'expo', 'circ', 'back', 'elastic', 'bounce']
const GSAP_EASES = ['none', ...EASE_FAMILIES.flatMap((f) => [`${f}.in`, `${f}.out`, `${f}.inOut`])]

// The easings.net curve set as cubic-beziers (elastic/bounce need springs —
// not expressible as a single cubic-bezier, so they're absent in CSS mode).
const CSS_EASES: Array<{ label: string; value: string }> = [
  { label: 'linear', value: 'linear' },
  { label: 'ease', value: 'ease' },
  { label: 'ease-in', value: 'ease-in' },
  { label: 'ease-out', value: 'ease-out' },
  { label: 'ease-in-out', value: 'ease-in-out' },
  { label: 'sine.in', value: 'cubic-bezier(0.12, 0, 0.39, 0)' },
  { label: 'sine.out', value: 'cubic-bezier(0.61, 1, 0.88, 1)' },
  { label: 'sine.inOut', value: 'cubic-bezier(0.37, 0, 0.63, 1)' },
  { label: 'power1.in', value: 'cubic-bezier(0.11, 0, 0.5, 0)' },
  { label: 'power1.out', value: 'cubic-bezier(0.5, 1, 0.89, 1)' },
  { label: 'power1.inOut', value: 'cubic-bezier(0.45, 0, 0.55, 1)' },
  { label: 'power2.in', value: 'cubic-bezier(0.32, 0, 0.67, 0)' },
  { label: 'power2.out', value: 'cubic-bezier(0.33, 1, 0.68, 1)' },
  { label: 'power2.inOut', value: 'cubic-bezier(0.65, 0, 0.35, 1)' },
  { label: 'power3.in', value: 'cubic-bezier(0.5, 0, 0.75, 0)' },
  { label: 'power3.out', value: 'cubic-bezier(0.25, 1, 0.5, 1)' },
  { label: 'power3.inOut', value: 'cubic-bezier(0.76, 0, 0.24, 1)' },
  { label: 'power4.in', value: 'cubic-bezier(0.64, 0, 0.78, 0)' },
  { label: 'power4.out', value: 'cubic-bezier(0.22, 1, 0.36, 1)' },
  { label: 'power4.inOut', value: 'cubic-bezier(0.83, 0, 0.17, 1)' },
  { label: 'expo.in', value: 'cubic-bezier(0.7, 0, 0.84, 0)' },
  { label: 'expo.out', value: 'cubic-bezier(0.16, 1, 0.3, 1)' },
  { label: 'expo.inOut', value: 'cubic-bezier(0.87, 0, 0.13, 1)' },
  { label: 'circ.in', value: 'cubic-bezier(0.55, 0, 1, 0.45)' },
  { label: 'circ.out', value: 'cubic-bezier(0, 0.55, 0.45, 1)' },
  { label: 'circ.inOut', value: 'cubic-bezier(0.85, 0, 0.15, 1)' },
  { label: 'back.in', value: 'cubic-bezier(0.36, 0, 0.66, -0.56)' },
  { label: 'back.out', value: 'cubic-bezier(0.34, 1.56, 0.64, 1)' },
  { label: 'back.inOut', value: 'cubic-bezier(0.68, -0.6, 0.32, 1.6)' },
]

function isCssEase(value: string): boolean {
  return /^(linear|ease|ease-in|ease-out|ease-in-out)$|cubic-bezier\(|steps\(/.test(value.trim())
}

function isEaseLeaf(leaf: TokenLeaf): boolean {
  if (typeof leaf.value !== 'string') return false
  const key = leaf.path[leaf.path.length - 1]?.toLowerCase() ?? ''
  return key.includes('ease') || GSAP_EASES.includes(leaf.value) || isCssEase(leaf.value)
}

// Inlined lucide icons — same no-dep policy as before (an icon library isn't
// worth a dependency for a dev overlay).
function iconProps(props: React.SVGProps<SVGSVGElement>): React.SVGProps<SVGSVGElement> {
  return {
    xmlns: 'http://www.w3.org/2000/svg',
    width: 14,
    height: 14,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    ...props,
  }
}

function PhoneIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconProps(props)}>
      <rect width="14" height="20" x="5" y="2" rx="2" ry="2" />
      <path d="M12 18h.01" />
    </svg>
  )
}
function TabletIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconProps(props)}>
      <rect width="16" height="20" x="4" y="2" rx="2" ry="2" />
      <path d="M12 18h.01" />
    </svg>
  )
}
function MonitorIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconProps(props)}>
      <rect width="20" height="14" x="2" y="3" rx="2" />
      <line x1="8" x2="16" y1="21" y2="21" />
      <line x1="12" x2="12" y1="17" y2="21" />
    </svg>
  )
}
// lucide circle-dot-dashed — the reduced-motion glyph.
function ReducedIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconProps(props)}>
      <path d="M10.1 2.18a9.93 9.93 0 0 1 3.8 0" />
      <path d="M17.6 3.71a9.95 9.95 0 0 1 2.69 2.7" />
      <path d="M21.82 10.1a9.93 9.93 0 0 1 0 3.8" />
      <path d="M20.29 17.6a9.95 9.95 0 0 1-2.7 2.69" />
      <path d="M13.9 21.82a9.94 9.94 0 0 1-3.8 0" />
      <path d="M6.4 20.29a9.95 9.95 0 0 1-2.69-2.7" />
      <path d="M2.18 13.9a9.93 9.93 0 0 1 0-3.8" />
      <path d="M3.71 6.4a9.95 9.95 0 0 1 2.7-2.69" />
      <circle cx="12" cy="12" r="1" />
    </svg>
  )
}
function PlayIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconProps({ fill: 'currentColor', stroke: 'none', ...props })}>
      <path d="m6 3 14 9-14 9z" />
    </svg>
  )
}
function SearchIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconProps(props)}>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  )
}
function CopyIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconProps(props)}>
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
  )
}
function ChevronDownIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconProps(props)}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

function breakpointIcon(name: string): ReactNode | null {
  const n = name.toLowerCase()
  if (n.includes('phone') || n.includes('mobile')) return <PhoneIcon />
  if (n.includes('tablet')) return <TabletIcon />
  if (n.includes('desktop') || n.includes('wide') || n.includes('laptop')) return <MonitorIcon />
  return null
}

function EaseControl({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  // The flavor is frozen at mount — picking a preset must not flip the list
  // out from under the open select.
  const [mode] = useState<'css' | 'gsap'>(() => (isCssEase(value) ? 'css' : 'gsap'))
  const catalog = mode === 'css' ? CSS_EASES : GSAP_EASES.map((e) => ({ label: e, value: e }))
  const options = catalog.some((o) => o.value === value)
    ? catalog
    : [{ label: value, value }, ...catalog]
  return (
    <select
      className="size-full cursor-pointer appearance-none rounded-full bg-transparent pr-8 pl-16 text-right text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

function NumberControl({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (v: number) => void
}) {
  // Bounds are frozen at mount so the scale never shifts mid-drag.
  const [range] = useState(() => sliderRange(value))
  // Draft while the box is focused — external updates (reset, breakpoint
  // force) flow straight through when not editing.
  const [draft, setDraft] = useState<string | null>(null)
  return (
    <>
      <Slider
        className="min-w-0 flex-1"
        label={label}
        min={Math.min(range.min, value)}
        max={Math.max(range.max, value)}
        step={range.step}
        value={[value]}
        onValueChange={(v: number | readonly number[]) => onChange(Array.isArray(v) ? v[0] : (v as number))}
      />
      <Input
        className="h-9 w-16 shrink-0 rounded-full border-input px-1 text-center text-xs"
        type="text"
        inputMode="decimal"
        value={draft ?? fmt(value)}
        onFocus={() => setDraft(fmt(value))}
        onBlur={() => setDraft(null)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        }}
        onChange={(e) => {
          setDraft(e.target.value)
          const parsed = Number(e.target.value)
          if (!Number.isNaN(parsed) && e.target.value.trim() !== '') onChange(parsed)
        }}
      />
    </>
  )
}

function TextControl({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [draft, setDraft] = useState<string | null>(null)
  return (
    <input
      className="h-full min-w-0 flex-1 bg-transparent pr-3.5 text-right text-xs text-foreground outline-none"
      type="text"
      value={draft ?? value}
      onFocus={() => setDraft(value)}
      onBlur={() => setDraft(null)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
      }}
      onChange={(e) => {
        setDraft(e.target.value)
        onChange(e.target.value)
      }}
    />
  )
}

function LeafRow({
  leaf,
  dirty,
  onChange,
  onReset,
}: {
  leaf: TokenLeaf
  dirty: boolean
  onChange: (value: TokenValue) => void
  onReset: () => void
}) {
  const name = leaf.path[leaf.path.length - 1]
  // The dot marks a tweaked row AND resets it — a stray drag is visible and
  // individually undoable, so it can't ride into a save unnoticed.
  const dot = (
    <button
      className={cn(
        'size-2 shrink-0 rounded-full bg-foreground',
        dirty ? 'visible cursor-pointer' : 'invisible',
      )}
      title="tweaked — click to reset to the saved value"
      aria-label={`reset ${name}`}
      tabIndex={dirty ? 0 : -1}
      onClick={onReset}
    />
  )
  if (typeof leaf.value === 'number') {
    return (
      <div className="flex items-center gap-1.5 py-[3px]" title={leaf.path.join('.')}>
        <NumberControl label={name} value={leaf.value} onChange={onChange} />
        {dot}
      </div>
    )
  }
  const isEase = typeof leaf.value === 'string' && isEaseLeaf(leaf)
  return (
    <div className="flex items-center gap-1.5 py-[3px]" title={leaf.path.join('.')}>
      <div className="relative flex h-9 min-w-0 flex-1 items-center rounded-full border border-input">
        <span className="pointer-events-none absolute left-3.5 z-10 text-xs text-muted-foreground">
          {name}
        </span>
        {typeof leaf.value === 'boolean' ? (
          <span className="flex flex-1 justify-end pr-2">
            <Switch checked={leaf.value} onCheckedChange={(c: boolean) => onChange(c === true)} />
          </span>
        ) : isEase ? (
          <>
            <EaseControl value={leaf.value as string} onChange={onChange} />
            <ChevronDownIcon className="pointer-events-none absolute right-3 text-muted-foreground" />
          </>
        ) : (
          <TextControl value={leaf.value as string} onChange={onChange} />
        )}
      </div>
      {dot}
    </div>
  )
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <div className="text-sm font-medium">{children}</div>
}

interface TokenBlock {
  key: string // 'base', a breakpoint name, or 'reduced'
  leaves: TokenLeaf[]
}

interface TokenGroup {
  path: string[] // parent path with the override-block key stripped
  blocks: TokenBlock[]
}

/** Group leaves by parent path, folding breakpoint/`reduced` override blocks
 * into their base group as tabs: `shell.menu.phone.yPercent` lands in group
 * `shell › menu` under the `phone` tab. Only blocks that exist in the file
 * become tabs — the overlay edits values, it doesn't invent structure. */
function groupLeaves(leaves: TokenLeaf[], overrideKeys: Set<string>, order: string[]): TokenGroup[] {
  const groups: TokenGroup[] = []
  const byPath = new Map<string, TokenGroup>()
  for (const leaf of leaves) {
    const parent = leaf.path.slice(0, -1)
    const last = parent[parent.length - 1]
    const isOverride = last !== undefined && overrideKeys.has(last)
    const path = isOverride ? parent.slice(0, -1) : parent
    const blockKey = isOverride ? last : 'base'
    const id = path.join('.')
    let group = byPath.get(id)
    if (!group) {
      group = { path, blocks: [] }
      byPath.set(id, group)
      groups.push(group)
    }
    let block = group.blocks.find((b) => b.key === blockKey)
    if (!block) {
      block = { key: blockKey, leaves: [] }
      group.blocks.push(block)
    }
    block.leaves.push(leaf)
  }
  for (const group of groups)
    group.blocks.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key))
  return groups
}

// A route id as it's written in a transition filename: `/` → `-`, brackets
// dropped (work/[slug] → work-slug) — matches @modulato/vite's convention.
function slugRoute(id: string): string {
  return id.replace(/\//g, '-').replace(/[[\]]/g, '')
}

/** Is a motion file relevant to the current route? Shell is always; a page
 * file matches its own route; a transition file matches when the current
 * route is one of its `<from>__<to>` sides (default = the fallback, always).
 * Derived purely from the path — no core changes needed. */
function relevantToRoute(file: string, route: string | null): boolean {
  if (file === '/motion.ts') return true
  const page = file.match(/^\/pages\/(.+)\/motion\.ts$/)
  if (page) return route != null && page[1] === route
  const transition = file.match(/^\/transitions\/(.+)\.motion\.ts$/)
  if (transition) {
    const name = transition[1]
    if (name === 'default') return true
    return route != null && name.split('__').includes(slugRoute(route))
  }
  return false
}

function blockIcon(key: string): ReactNode {
  if (key === 'base') return <MonitorIcon />
  if (key === 'reduced') return <ReducedIcon />
  return breakpointIcon(key) ?? <span className="px-0.5 text-[10px]">{key}</span>
}

function blockTitle(key: string): string {
  if (key === 'base') return 'base values (desktop)'
  if (key === 'reduced') return 'reduced-motion overrides'
  return `${key} overrides`
}

/** One token group: a two-tone path header, icon tabs for the base/breakpoint/
 * reduced blocks that exist in the file, and the active block's rows below. */
function GroupSection({
  group,
  dirtySet,
  query,
  onChange,
  onReset,
}: {
  group: TokenGroup
  dirtySet: Set<string>
  query: string
  onChange: (leaf: TokenLeaf, value: TokenValue) => void
  onReset: (leaf: TokenLeaf) => void
}) {
  const [active, setActive] = useState('base')
  // Dirty rows stay visible even when the filter excludes them — what Save
  // will write must never be off-screen.
  const rowsOf = (block: TokenBlock) =>
    query
      ? block.leaves.filter(
          (l) =>
            l.path.join('.').toLowerCase().includes(query) ||
            dirtySet.has(l.path.join('.')),
        )
      : block.leaves
  const withRows = group.blocks
    .map((b) => ({ ...b, rows: rowsOf(b) }))
    .filter((b) => b.rows.length > 0)
  if (!withRows.length) return null
  const displayed = withRows.find((b) => b.key === active) ?? withRows[0]
  const leafSeg = group.path[group.path.length - 1]
  return (
    <div className="mt-2.5">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1 truncate text-xs text-muted-foreground">
          {group.path.slice(0, -1).map((seg, i) => (
            <span key={i} className="flex items-center gap-1">
              {seg} <span className="text-muted-foreground/60">›</span>
            </span>
          ))}
          <span className="font-medium text-foreground">{leafSeg ?? 'root'}</span>
        </span>
        {withRows.length > 1 && (
          <span className="flex shrink-0 items-center gap-0.5">
            {withRows.map((b) => {
              const isActive = displayed.key === b.key
              const blockDirty = b.leaves.some((l) => dirtySet.has(l.path.join('.')))
              return (
                <button
                  key={b.key}
                  className={cn(
                    'relative flex size-6 cursor-pointer items-center justify-center rounded-full',
                    isActive
                      ? 'text-foreground'
                      : 'text-muted-foreground/50 hover:text-muted-foreground',
                  )}
                  title={blockTitle(b.key)}
                  aria-label={blockTitle(b.key)}
                  aria-pressed={isActive}
                  onClick={() => setActive(b.key)}
                >
                  {blockIcon(b.key)}
                  {/* A dirty block is flagged on its tab — pending edits behind
                      a non-active tab must never be invisible. */}
                  {blockDirty && !isActive && (
                    <span className="absolute top-0.5 right-0.5 size-1.5 rounded-full bg-foreground" />
                  )}
                </button>
              )
            })}
          </span>
        )}
      </div>
      {displayed.rows.map((leaf) => {
        const key = leaf.path.join('.')
        return (
          <LeafRow
            key={key}
            leaf={leaf}
            dirty={dirtySet.has(key)}
            onChange={(value) => onChange(leaf, value)}
            onReset={() => onReset(leaf)}
          />
        )
      })}
    </div>
  )
}

function Overlay() {
  const handle = useHandle()
  const [open, setOpen] = useState(false)
  const [loop, setLoop] = useState(false)
  const [filter, setFilter] = useState('')
  const [showAll, setShowAll] = useState(false)
  const [status, setStatus] = useState('')
  const [forcedBp, setForcedBp] = useState<string | null>(null)
  const [forcedReduced, setForcedReduced] = useState(false)
  const loopRef = useRef(false)
  loopRef.current = loop

  const version = useSyncExternalStore(
    useCallback((cb) => handle?.tokens.subscribe(cb) ?? (() => {}), [handle]),
    () => handle?.tokens.version ?? 0,
  )

  // Speed lives in the core and can change without a click here (MCP remote).
  // Subscribe to the core's own event — the active pill must never depend on
  // an incidental rerender to move.
  const speed = useSyncExternalStore(
    useCallback((cb: () => void) => {
      window.addEventListener('modulato:speed', cb)
      return () => window.removeEventListener('modulato:speed', cb)
    }, []),
    () => handle?.speed ?? 1,
  )

  const replayTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const queueReplay = useCallback(() => {
    if (replayTimer.current) clearTimeout(replayTimer.current)
    replayTimer.current = setTimeout(() => handle?.replayMotions(), 150)
  }, [handle])

  // Loop mode: replay the current page's intro back-to-back.
  useEffect(() => {
    if (!loop || !handle) return undefined
    let alive = true
    const cycle = async () => {
      while (alive && loopRef.current) {
        await handle.replayIntro()
        await new Promise((r) => setTimeout(r, 500))
      }
    }
    void cycle()
    return () => {
      alive = false
    }
  }, [loop, handle])

  if (!handle) return null
  const allFiles = handle.tokens.list()
  // Scope to the current view: shell + this page + transitions touching this
  // route. A dirty file always shows (a pending save must never be hidden),
  // and "show all" reveals the rest without navigating there.
  const inScope = (file: string) =>
    relevantToRoute(file, handle.route) || handle.tokens.dirty(file).length > 0
  const files = showAll ? allFiles : allFiles.filter((f) => inScope(f.file))
  const hiddenCount = allFiles.length - allFiles.filter((f) => inScope(f.file)).length

  const bpNames = handle.viewport.names()
  const overrideKeys = new Set([...bpNames, 'reduced'])
  const blockOrder = ['base', ...bpNames, 'reduced']

  const save = async (file: string) => {
    const changes = handle.tokens.dirty(file)
    if (!changes.length) return
    setStatus('saving…')
    try {
      const res = await fetch('/__modulato/tokens', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ file, changes }),
      })
      const body = (await res.json()) as { ok: boolean; error?: string }
      if (!body.ok) throw new Error(body.error)
      handle.tokens.markSaved(file)
      setStatus(`saved ${file}`)
    } catch (error) {
      setStatus(`save failed: ${String(error)}`)
    }
    setTimeout(() => setStatus(''), 2500)
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="fixed right-3 bottom-3 z-50 rounded-full bg-background text-xs shadow-lg"
        onClick={() => setOpen((o) => !o)}
      >
        {open ? '× Tweak' : '✦ Tweak'}
      </Button>
      {open && (
        // data-lenis-prevent: the page's Lenis must not intercept wheel/touch
        // over the panel, or its own scrollbar never moves.
        <div
          className="fixed right-3 bottom-14 z-50 flex max-h-[75vh] w-[380px] flex-col overflow-y-auto overscroll-contain rounded-2xl border bg-background text-xs shadow-2xl"
          data-version={version}
          data-lenis-prevent=""
        >
          {/* ── replay: what to play ─────────────────────────────────── */}
          <div className="p-4 pb-3.5">
            <div className="mb-2.5 flex items-center justify-between">
              <SectionTitle>Replay</SectionTitle>
              <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                <Switch checked={loop} onCheckedChange={(c: boolean) => setLoop(c === true)} />
                Loop
              </label>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Button size="sm" className="h-8 rounded-full px-3.5 text-xs" onClick={() => void handle.replayIntro()}>
                <PlayIcon className="size-2.5" /> Intro
              </Button>
              <Button size="sm" className="h-8 rounded-full px-3.5 text-xs" onClick={() => void handle.replayShellIntro()}>
                <PlayIcon className="size-2.5" /> Shell
              </Button>
              <Button size="sm" className="h-8 rounded-full px-3.5 text-xs" onClick={() => handle.replayMotions()}>
                <PlayIcon className="size-2.5" /> Motions
              </Button>
            </div>
          </div>

          <Separator />

          {/* ── preview context: replays run AS this breakpoint/speed ──── */}
          <div className="p-4 pt-3.5 pb-3.5">
            <div className="flex items-center justify-between gap-2">
              <SectionTitle>Preview as</SectionTitle>
              <div className="flex shrink-0 items-center gap-0.5">
                <button
                  className={cn(
                    'h-6 cursor-pointer rounded-full px-1.5 text-xs',
                    forcedBp === null
                      ? 'font-medium text-foreground'
                      : 'text-muted-foreground/60 hover:text-muted-foreground',
                  )}
                  title="auto (follow the real viewport)"
                  onClick={() => {
                    setForcedBp(null)
                    handle.viewport.force(null)
                    queueReplay()
                  }}
                >
                  Auto
                </button>
                {bpNames.map((name) => (
                  <button
                    key={name}
                    className={cn(
                      'flex size-6 cursor-pointer items-center justify-center rounded-full',
                      forcedBp === name
                        ? 'text-foreground'
                        : 'text-muted-foreground/60 hover:text-muted-foreground',
                    )}
                    title={name}
                    aria-label={name}
                    aria-pressed={forcedBp === name}
                    onClick={() => {
                      setForcedBp(name)
                      handle.viewport.force(name)
                      queueReplay()
                    }}
                  >
                    {breakpointIcon(name) ?? <span className="px-1 text-xs">{name}</span>}
                  </button>
                ))}
                <button
                  className={cn(
                    'flex size-6 cursor-pointer items-center justify-center rounded-full',
                    forcedReduced
                      ? 'text-foreground'
                      : 'text-muted-foreground/60 hover:text-muted-foreground',
                  )}
                  title="prefers-reduced-motion"
                  aria-label="prefers-reduced-motion"
                  aria-pressed={forcedReduced}
                  onClick={() => {
                    const next = !forcedReduced
                    setForcedReduced(next)
                    handle.viewport.forceReduced(next ? true : null)
                    queueReplay()
                  }}
                >
                  <ReducedIcon />
                </button>
              </div>
            </div>
            <div className="mt-2.5 flex h-9 rounded-full bg-secondary">
              {[0.1, 0.25, 0.5, 1].map((s) => (
                <button
                  key={s}
                  className={cn(
                    'h-full flex-1 cursor-pointer rounded-full text-xs transition-colors',
                    speed === s
                      ? 'bg-primary font-medium text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                  onClick={() => handle.setSpeed(s)}
                >
                  {fmt(s)}x
                </button>
              ))}
            </div>
          </div>

          <Separator />

          {/* ── tokens ──────────────────────────────────────────────── */}
          <div className="p-4 pt-3.5 pb-3">
            <div className="flex items-center justify-between">
              <SectionTitle>Tokens</SectionTitle>
              {(hiddenCount > 0 || showAll) && (
                <button
                  className="cursor-pointer text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => setShowAll(!showAll)}
                >
                  {showAll ? 'Current view' : `Show all (+${hiddenCount})`}
                </button>
              )}
            </div>
            {allFiles.length > 0 && (
              <div className="relative mt-2.5">
                <Input
                  className="h-9 rounded-full border-input px-8 text-center text-xs"
                  type="text"
                  placeholder="Filter tokens"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                />
                {filter ? (
                  <button
                    className="absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer text-muted-foreground hover:text-foreground"
                    title="clear filter"
                    onClick={() => setFilter('')}
                  >
                    ×
                  </button>
                ) : (
                  <SearchIcon className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground" />
                )}
              </div>
            )}
          </div>

          {/* Cards inside a card: each motion file is a white rounded card on
              the panel's gray well. */}
          <div className="flex grow flex-col gap-2 bg-muted p-2">
            {!allFiles.length && (
              <div className="rounded-xl bg-background p-3.5 text-muted-foreground">
                no motion tokens registered — create a motion.ts next to a page and
                read it from your intro/useMotion code.
              </div>
            )}
            {files.map(({ file }) => {
              const leaves = handle.tokens.leaves(file)
              const dirtySet = new Set(handle.tokens.dirty(file).map((l) => l.path.join('.')))
              const query = filter.trim().toLowerCase()
              const groups = groupLeaves(leaves, overrideKeys, blockOrder)
              const groupVisible = (g: TokenGroup) =>
                g.blocks.some((b) =>
                  b.leaves.some(
                    (l) =>
                      !query ||
                      l.path.join('.').toLowerCase().includes(query) ||
                      dirtySet.has(l.path.join('.')),
                  ),
                )
              const shownGroups = groups.filter(groupVisible)
              if (query && !shownGroups.length) return null
              return (
                <div key={file} className="rounded-xl bg-background p-3.5">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <button
                      className="shrink-0 cursor-pointer text-foreground/60 hover:text-foreground"
                      title="copy file path"
                      aria-label={`copy ${file}`}
                      onClick={() => void navigator.clipboard?.writeText(file)}
                    >
                      <CopyIcon />
                    </button>
                    <span className="truncate text-[13px] font-semibold">{file}</span>
                  </div>
                  {shownGroups.map((group) => (
                    <GroupSection
                      key={group.path.join('.') || '(root)'}
                      group={group}
                      dirtySet={dirtySet}
                      query={query}
                      onChange={(leaf, value) => {
                        handle.tokens.set(file, leaf.path, value)
                        queueReplay()
                      }}
                      onReset={(leaf) => {
                        handle.tokens.resetLeaf(file, leaf.path)
                        queueReplay()
                      }}
                    />
                  ))}
                  <div className="mt-3 flex gap-1.5">
                    <Button
                      size="sm"
                      className="h-8 flex-1 rounded-full text-xs"
                      disabled={!dirtySet.size}
                      onClick={() => void save(file)}
                    >
                      Save{dirtySet.size ? ` (${dirtySet.size})` : ''}
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="h-8 flex-1 rounded-full text-xs"
                      disabled={!dirtySet.size}
                      onClick={() => {
                        handle.tokens.reset(file)
                        queueReplay()
                      }}
                    >
                      Reset
                    </Button>
                  </div>
                </div>
              )
            })}
            {status && <div className="px-2 pb-1 text-[11px] text-muted-foreground">{status}</div>}
          </div>
        </div>
      )}
    </>
  )
}

/** Mount the Tweak overlay (idempotent). Shadow DOM keeps the shadcn styles
 * fully isolated from the host site — and the host's styles out. */
export function mount(): void {
  if (typeof document === 'undefined') return
  if (document.getElementById('__modulato-tweak')) return
  // The @font-face must live in the DOCUMENT: Chromium ignores font faces
  // declared inside shadow trees. The family name is ours alone ('Inter
  // Tweak') so a host site's own Inter faces are never shadowed or reordered.
  if (!document.getElementById('__modulato-tweak-font')) {
    const font = document.createElement('style')
    font.id = '__modulato-tweak-font'
    font.textContent = `@font-face { font-family: 'Inter Tweak'; font-style: normal; font-weight: 100 900; font-display: swap; src: url(${JSON.stringify(interUrl)}) format('woff2'); }`
    document.head.appendChild(font)
  }
  const host = document.createElement('div')
  host.id = '__modulato-tweak'
  host.setAttribute('data-lenis-prevent', '')
  document.body.appendChild(host)
  const shadow = host.attachShadow({ mode: 'open' })
  const style = document.createElement('style')
  style.textContent = css
  shadow.appendChild(style)
  const root = document.createElement('div')
  root.className = 'font-sans text-foreground'
  shadow.appendChild(root)
  void import('react-dom/client').then(({ createRoot }) => {
    createRoot(root).render(<Overlay />)
  })
}
