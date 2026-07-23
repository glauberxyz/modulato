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
import { Checkbox } from './ui/checkbox'
import { Separator } from './ui/separator'
import { Badge } from './ui/badge'
import { cn } from './ui/utils'
import css from './overlay.css?inline'

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

// Inlined lucide icons for the breakpoint pills (Smartphone / Tablet /
// Monitor) — same no-dep policy as CheckIcon. Names are site-defined, so the
// mapping is fuzzy and unknown names fall back to their text label.
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

function breakpointIcon(name: string): ReactNode | null {
  const n = name.toLowerCase()
  if (n.includes('phone') || n.includes('mobile')) return <PhoneIcon />
  if (n.includes('tablet')) return <TabletIcon />
  if (n.includes('desktop') || n.includes('wide') || n.includes('laptop')) return <MonitorIcon />
  return null
}

const selectClass =
  'h-7 rounded-md border border-input bg-input/30 px-2 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50 cursor-pointer'

function EaseControl({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  // The flavor is frozen at mount — picking a preset must not flip the list
  // out from under the open select.
  const [mode] = useState<'css' | 'gsap'>(() => (isCssEase(value) ? 'css' : 'gsap'))
  const catalog = mode === 'css' ? CSS_EASES : GSAP_EASES.map((e) => ({ label: e, value: e }))
  const options = catalog.some((o) => o.value === value)
    ? catalog
    : [{ label: value, value }, ...catalog]
  return (
    <select className={selectClass} value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

function NumberControl({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  // Bounds are frozen at mount so the scale never shifts mid-drag.
  const [range] = useState(() => sliderRange(value))
  // Draft while the box is focused — external updates (reset, breakpoint
  // force) flow straight through when not editing.
  const [draft, setDraft] = useState<string | null>(null)
  return (
    <>
      <Slider
        className="w-24 shrink-0 data-horizontal:w-24"
        min={Math.min(range.min, value)}
        max={Math.max(range.max, value)}
        step={range.step}
        value={[value]}
        onValueChange={(v: number | readonly number[]) => onChange(Array.isArray(v) ? v[0] : (v as number))}
      />
      <Input
        className="h-7 w-14 px-1.5 text-right text-xs"
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
    <Input
      className="h-7 w-32 px-1.5 text-xs"
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
  const control =
    typeof leaf.value === 'boolean' ? (
      <Checkbox checked={leaf.value} onCheckedChange={(c: boolean) => onChange(c === true)} />
    ) : typeof leaf.value === 'number' ? (
      <NumberControl value={leaf.value} onChange={onChange} />
    ) : isEaseLeaf(leaf) ? (
      <EaseControl value={leaf.value} onChange={onChange} />
    ) : (
      <TextControl value={leaf.value} onChange={onChange} />
    )
  return (
    <div className="flex items-center gap-2 py-0.5">
      <span
        className={cn(
          'min-w-0 flex-1 truncate text-xs',
          dirty ? 'font-medium text-primary' : 'text-muted-foreground',
        )}
        title={leaf.path.join('.')}
      >
        {name}
      </span>
      {control}
      {/* Dirty rows are marked and individually undoable — a stray drag can't
          ride into a save unnoticed. */}
      <button
        className={cn(
          'w-4 shrink-0 cursor-pointer text-primary hover:text-foreground',
          dirty ? 'visible' : 'invisible',
        )}
        title="reset this token"
        onClick={onReset}
      >
        ↺
      </button>
    </div>
  )
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="mb-1.5 text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
      {children}
    </div>
  )
}

/** Group leaves by parent path (`shell.menu.phone.yPercent` → group
 * "shell › menu › phone", row "yPercent") — the hierarchy reads once per
 * group instead of repeating on every row. */
function groupLeaves(leaves: TokenLeaf[]): Array<{ group: string; leaves: TokenLeaf[] }> {
  const groups: Array<{ group: string; leaves: TokenLeaf[] }> = []
  for (const leaf of leaves) {
    const group = leaf.path.slice(0, -1).join(' › ')
    const last = groups[groups.length - 1]
    if (last && last.group === group) last.leaves.push(leaf)
    else groups.push({ group, leaves: [leaf] })
  }
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
        size="sm"
        className="fixed right-3 bottom-3 z-50 rounded-full font-mono text-xs shadow-lg"
        onClick={() => setOpen((o) => !o)}
      >
        {open ? '× motion' : '✦ motion'}
      </Button>
      {open && (
        // data-lenis-prevent: the page's Lenis must not intercept wheel/touch
        // over the panel, or its own scrollbar never moves.
        <div
          className="fixed right-3 bottom-14 z-50 max-h-[75vh] w-[380px] overflow-y-auto overscroll-contain rounded-xl border bg-background p-4 text-xs shadow-2xl"
          data-version={version}
          data-lenis-prevent=""
        >
          {/* ── replay: what to play ─────────────────────────────────── */}
          <SectionLabel>replay</SectionLabel>
          <div className="flex flex-wrap items-center gap-1.5">
            <Button variant="secondary" size="sm" className="h-7 px-2.5 text-xs" onClick={() => void handle.replayIntro()}>
              intro
            </Button>
            <Button variant="secondary" size="sm" className="h-7 px-2.5 text-xs" onClick={() => void handle.replayShellIntro()}>
              shell
            </Button>
            <Button variant="secondary" size="sm" className="h-7 px-2.5 text-xs" onClick={() => handle.replayMotions()}>
              motions
            </Button>
            <label className="ml-1 flex cursor-pointer items-center gap-1.5 text-muted-foreground">
              <Checkbox checked={loop} onCheckedChange={(c: boolean) => setLoop(c === true)} />
              loop
            </label>
          </div>

          <Separator className="my-3" />

          {/* ── preview context: replays run AS this breakpoint/speed ──── */}
          <SectionLabel>preview as</SectionLabel>
          <div className="flex flex-wrap items-center gap-1.5">
            {[null, ...handle.viewport.names()].map((name) => {
              const icon = name ? breakpointIcon(name) : null
              return (
                <Button
                  key={name ?? 'auto'}
                  variant={forcedBp === name ? 'default' : 'outline'}
                  size="sm"
                  className={icon ? 'h-7 w-7 px-0 text-xs' : 'h-7 px-2.5 text-xs'}
                  title={name ?? 'auto (follow the real viewport)'}
                  aria-label={name ?? 'auto'}
                  onClick={() => {
                    setForcedBp(name)
                    handle.viewport.force(name)
                    queueReplay()
                  }}
                >
                  {icon ?? (name ?? 'auto')}
                </Button>
              )
            })}
            <label className="flex cursor-pointer items-center gap-1.5 text-muted-foreground">
              <Checkbox
                checked={forcedReduced}
                onCheckedChange={(c: boolean) => {
                  setForcedReduced(c === true)
                  handle.viewport.forceReduced(c === true ? true : null)
                  queueReplay()
                }}
              />
              reduced
            </label>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {[1, 0.5, 0.25, 0.1].map((s) => (
              <Button
                key={s}
                variant={handle.speed === s ? 'default' : 'outline'}
                size="sm"
                className="h-7 px-2.5 text-xs"
                onClick={() => {
                  handle.setSpeed(s)
                  setStatus(s === 1 ? '' : `${s}× speed`)
                }}
              >
                {s}×
              </Button>
            ))}
          </div>

          <Separator className="my-3" />

          {/* ── tokens ──────────────────────────────────────────────── */}
          <div className="mb-1.5 flex items-center justify-between">
            <SectionLabel>tokens</SectionLabel>
            {(hiddenCount > 0 || showAll) && (
              <label className="flex cursor-pointer items-center gap-1.5 text-[10px] text-muted-foreground normal-case">
                <Checkbox checked={showAll} onCheckedChange={(c: boolean) => setShowAll(c === true)} />
                {showAll ? `all files` : `show all (+${hiddenCount})`}
              </label>
            )}
          </div>
          {!allFiles.length && (
            <div className="text-muted-foreground">
              no motion tokens registered — create a motion.ts next to a page and read it
              from your intro/useMotion code.
            </div>
          )}
          {allFiles.length > 0 && (
            <div className="relative">
              <Input
                className="h-7 pr-7 text-xs"
                type="text"
                placeholder="filter tokens…"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
              {filter && (
                <button
                  className="absolute top-1/2 right-2 -translate-y-1/2 cursor-pointer text-muted-foreground hover:text-foreground"
                  title="clear filter"
                  onClick={() => setFilter('')}
                >
                  ×
                </button>
              )}
            </div>
          )}
          {files.map(({ file }) => {
            const leaves = handle.tokens.leaves(file)
            const dirtySet = new Set(handle.tokens.dirty(file).map((l) => l.path.join('.')))
            const query = filter.trim().toLowerCase()
            // Dirty rows stay visible even when the filter excludes them — what
            // Save will write must never be off-screen.
            const shown = query
              ? leaves.filter(
                  (l) =>
                    l.path.join('.').toLowerCase().includes(query) ||
                    dirtySet.has(l.path.join('.')),
                )
              : leaves
            if (query && !shown.length) return null
            return (
              <div key={file} className="mt-3">
                <div className="mb-1 flex items-center gap-2">
                  <span className="font-mono font-medium text-foreground">{file}</span>
                  {dirtySet.size > 0 && (
                    <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                      {dirtySet.size} unsaved
                    </Badge>
                  )}
                </div>
                {groupLeaves(shown).map(({ group, leaves: groupLeaves }) => (
                  <div key={group || '(root)'} className="mb-1.5">
                    {group && (
                      <div className="mt-1.5 mb-0.5 text-[10px] font-medium text-muted-foreground/70">
                        {group}
                      </div>
                    )}
                    <div className={group ? 'pl-2' : ''}>
                      {groupLeaves.map((leaf) => {
                        const key = leaf.path.join('.')
                        return (
                          <LeafRow
                            key={key}
                            leaf={leaf}
                            dirty={dirtySet.has(key)}
                            onChange={(value) => {
                              handle.tokens.set(file, leaf.path, value)
                              queueReplay()
                            }}
                            onReset={() => {
                              handle.tokens.resetLeaf(file, leaf.path)
                              queueReplay()
                            }}
                          />
                        )
                      })}
                    </div>
                  </div>
                ))}
                <div className="mt-1.5 flex gap-1.5">
                  <Button
                    size="sm"
                    className="h-7 px-2.5 text-xs"
                    disabled={!dirtySet.size}
                    onClick={() => void save(file)}
                  >
                    save{dirtySet.size ? ` (${dirtySet.size})` : ''}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2.5 text-xs"
                    disabled={!dirtySet.size}
                    onClick={() => {
                      handle.tokens.reset(file)
                      queueReplay()
                    }}
                  >
                    reset
                  </Button>
                </div>
              </div>
            )
          })}
          {status && <div className="mt-2 text-primary">{status}</div>}
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
  const host = document.createElement('div')
  host.id = '__modulato-tweak'
  host.setAttribute('data-lenis-prevent', '')
  document.body.appendChild(host)
  const shadow = host.attachShadow({ mode: 'open' })
  const style = document.createElement('style')
  style.textContent = css
  shadow.appendChild(style)
  const root = document.createElement('div')
  root.className = 'dark font-sans text-foreground'
  shadow.appendChild(root)
  void import('react-dom/client').then(({ createRoot }) => {
    createRoot(root).render(<Overlay />)
  })
}
