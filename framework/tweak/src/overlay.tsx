import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import type { DeclaredEase, TokenLeaf, TokenValue } from 'modulato'
import { useHandle } from './handle'
import { saveTokens } from './save'
import { TypeIcon, TypeMode, typeMode, useTypeMode } from './type'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Slider } from './ui/slider'
import { Switch } from './ui/switch'
import { cn } from './ui/utils'
import css from './overlay.css?inline'
// Inter variable (latin subset, OFL — see inter-license.txt), vendored from
// @fontsource-variable/inter@5.3.0. Bundled so the overlay renders Inter even
// on machines without it installed (or with only stray weights installed).
import interUrl from './inter.woff2'
import { Inspect } from './inspect'

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
// either catalog (project CustomEase) is kept as its own option. Curves
// declared in modulato.config lead BOTH catalogs under their config name —
// picking one writes the name into a GSAP field and the cubic-bezier into a
// transition field, so every file keeps a value its own backend speaks.
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

function isEaseLeaf(leaf: TokenLeaf, declared: DeclaredEase[]): boolean {
  if (typeof leaf.value !== 'string') return false
  const key = leaf.path[leaf.path.length - 1]?.toLowerCase() ?? ''
  return (
    key.includes('ease') ||
    GSAP_EASES.includes(leaf.value) ||
    isCssEase(leaf.value) ||
    declared.some((e) => e.name === leaf.value)
  )
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

/** What Loop replays — the Replay button most recently pressed. */
type LoopTarget = 'intro' | 'shell' | 'motions'

/** The project's typography module, as the registry keys it. */
const TYPE_FILE = '/type.ts'

type PanelTab = 'motion' | 'type' | 'colors'

const RING_R = 10
const RING_C = 2 * Math.PI * RING_R

/** Loop progress ring: replaces the play glyph while Loop is on. `ms` is the
 * measured duration of the previous cycle (intro + gap) — the ring fills over
 * exactly that span (`key` restarts the CSS animation each cycle). Until the
 * first cycle has been measured it spins indeterminately. Hairline by design:
 * strokeWidth 2 in a 24-unit viewBox renders ~1px at this size. */
function LoopRingIcon({ ms, n }: { ms: number | null; n: number }) {
  return (
    <svg
      key={n}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      className={cn('size-3', ms === null && 'animate-spin')}
    >
      <circle cx="12" cy="12" r={RING_R} opacity="0.3" />
      <circle
        cx="12"
        cy="12"
        r={RING_R}
        strokeDasharray={RING_C}
        strokeDashoffset={ms === null ? RING_C * 0.75 : RING_C}
        strokeLinecap="round"
        transform="rotate(-90 12 12)"
        style={ms === null ? undefined : { animation: `tweak-ring ${Math.round(ms)}ms linear forwards` }}
      />
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
// lucide file-stack — the motion-file glyph (14x14 via iconProps defaults).
function FileStackIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconProps(props)}>
      <path d="M21 7h-3a2 2 0 0 1-2-2V2" />
      <path d="M21 6v6.5c0 .8-.7 1.5-1.5 1.5h-7c-.8 0-1.5-.7-1.5-1.5v-9c0-.8.7-1.5 1.5-1.5H17Z" />
      <path d="M7 8v8.8c0 .3.2.6.4.8.2.2.5.4.8.4H15" />
      <path d="M3 12v8.8c0 .3.2.6.4.8.2.2.5.4.8.4H11" />
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

function EaseControl({
  value,
  declared,
  onChange,
}: {
  value: string
  declared: DeclaredEase[]
  onChange: (v: string) => void
}) {
  // The flavor is frozen at mount — picking a preset must not flip the list
  // out from under the open select. A declared name is GSAP-flavored (that's
  // the spelling GSAP resolves); the same curve reaches a CSS field as its
  // cubic-bezier, so the two spellings never cross backends.
  const [mode] = useState<'css' | 'gsap'>(() => (isCssEase(value) ? 'css' : 'gsap'))
  // Config-declared curves lead both catalogs, labeled with their config
  // name — the CSS value differs, the name the author reads doesn't.
  const declaredOptions = declared.map((e) => ({
    label: e.name,
    value: mode === 'css' ? e.css : e.name,
  }))
  const base = mode === 'css' ? CSS_EASES : GSAP_EASES.map((e) => ({ label: e, value: e }))
  // A declared curve can be byte-identical to a preset (swoosh ==
  // expo.out's bezier); keep the declared one — it carries the author's
  // name — and drop the duplicate, which would collide as a React key.
  const declaredValues = new Set(declaredOptions.map((o) => o.value))
  const catalog = [...declaredOptions, ...base.filter((o) => !declaredValues.has(o.value))]
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

/**
 * A closed set of values, as a select.
 *
 * The ease control below is the same idea for one specific vocabulary; this is
 * the general one, used wherever a token field is a KEY into a catalog the
 * file already declares — a type style's `size` naming a scale step, its
 * `font` naming a font stack. Those were free-text boxes, and a free-text box
 * over a closed set is a typo generator: `var(--type-size-lgg)` is not an
 * error, it is a silent fallback to the inherited size.
 *
 * A value outside the catalog still shows, as its own leading option, because
 * the file is allowed to contain one and hiding it would make the row lie.
 */
function OptionControl({
  value,
  options,
  onChange,
}: {
  value: string
  options: Array<{ label: string; value: string }>
  onChange: (v: string) => void
}) {
  const known = options.some((o) => o.value === value)
  const list = known ? options : [{ label: `${value} (unknown)`, value }, ...options]
  return (
    <select
      className="size-full cursor-pointer appearance-none rounded-full bg-transparent pr-8 pl-16 text-right text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {list.map((o) => (
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
        className="h-9 w-16 shrink-0 rounded-full border-border bg-background px-1 text-center text-xs"
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
  declared,
  options,
  onChange,
  onReset,
}: {
  leaf: TokenLeaf
  dirty: boolean
  declared: DeclaredEase[]
  /** The closed set this field draws from, when it has one. */
  options: Array<{ label: string; value: string }> | null
  onChange: (value: TokenValue) => void
  onReset: () => void
}) {
  const name = leaf.path[leaf.path.length - 1]
  // The dot marks a tweaked row AND resets it — a stray drag is visible and
  // individually undoable, so it can't ride into a save unnoticed. It sits as
  // a corner badge on the control (white ring lifts it off the border) so
  // rows reach the card edge and align with the group's tab icons.
  const dot = (
    <button
      className={cn(
        'absolute top-0 right-0 size-2.5 rounded-full bg-foreground ring-2 ring-background',
        dirty ? 'visible cursor-pointer' : 'invisible',
      )}
      title="tweaked — click to reset to the saved value"
      aria-label={`reset ${name}`}
      tabIndex={dirty ? 0 : -1}
      onClick={onReset}
    />
  )
  const rowClass = 'relative flex items-center gap-1.5 py-1'
  if (typeof leaf.value === 'number') {
    return (
      <div className={rowClass} title={leaf.path.join('.')}>
        <NumberControl label={name} value={leaf.value} onChange={onChange} />
        {dot}
      </div>
    )
  }
  const isEase = typeof leaf.value === 'string' && isEaseLeaf(leaf, declared)
  return (
    <div className={rowClass} title={leaf.path.join('.')}>
      <div className="relative flex h-9 min-w-0 flex-1 items-center rounded-full border border-border bg-background">
        <span className="pointer-events-none absolute left-3.5 z-10 text-xs text-muted-foreground">
          {name}
        </span>
        {typeof leaf.value === 'boolean' ? (
          <span className="flex flex-1 justify-end pr-2">
            <Switch checked={leaf.value} onCheckedChange={(c: boolean) => onChange(c === true)} />
          </span>
        ) : options ? (
          <>
            <OptionControl
              value={leaf.value as string}
              options={options}
              onChange={onChange}
            />
            <ChevronDownIcon className="pointer-events-none absolute right-3 text-muted-foreground" />
          </>
        ) : isEase ? (
          <>
            <EaseControl value={leaf.value as string} declared={declared} onChange={onChange} />
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
    // An override block names the SAME group with one extra segment, wherever
    // that segment sits: `claim.reduced.amount` and `reduced.claim.amount`
    // both override `claim.amount`, and resolveTokens honours either spelling
    // at any depth (override keys are reserved at every level). Fold on the
    // override segment nearest the leaf, so the row lands in its real group's
    // icon tab instead of spawning a sibling card named after the override.
    let over = -1
    for (let i = parent.length - 1; i >= 0; i -= 1) {
      if (overrideKeys.has(parent[i])) {
        over = i
        break
      }
    }
    const path = over === -1 ? parent : parent.filter((_, i) => i !== over)
    const blockKey = over === -1 ? 'base' : parent[over]
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

/** Does a row match the filter? On EITHER spelling: its source path, or the
 *  path the panel displays — the folded group plus the row's own name. For a
 *  hoisted override (`intro.reduced.claim.amount`, shown under `intro › claim`)
 *  the two differ, and a reader types what they see: without the display path,
 *  querying `intro.claim` would hide the reduced tab of the very card it names. */
function rowMatches(query: string, groupPath: string[], leaf: TokenLeaf): boolean {
  if (leaf.path.join('.').toLowerCase().includes(query)) return true
  const shown = [...groupPath, leaf.path[leaf.path.length - 1]]
  return shown.join('.').toLowerCase().includes(query)
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
  groupHit,
  declared,
  optionsFor,
  onChange,
  onReset,
}: {
  group: TokenGroup
  dirtySet: Set<string>
  query: string
  /** The query matched the GROUP — its file path, or one of its hidden
   *  keywords — rather than any row inside it. The reader named a place or a
   *  purpose, not a value, so every row shows: narrowing them would answer a
   *  question nobody asked and leave the card standing with most of its
   *  contents missing. */
  groupHit: boolean
  declared: DeclaredEase[]
  /** Per-leaf closed sets, when the file declares catalogs a field draws from. */
  optionsFor?: (leaf: TokenLeaf) => Array<{ label: string; value: string }> | null
  onChange: (leaf: TokenLeaf, value: TokenValue) => void
  onReset: (leaf: TokenLeaf) => void
}) {
  const [active, setActive] = useState('base')
  // Dirty rows stay visible even when the filter excludes them — what Save
  // will write must never be off-screen.
  const rowsOf = (block: TokenBlock) =>
    query && !groupHit
      ? block.leaves.filter(
          (l) => rowMatches(query, group.path, l) || dirtySet.has(l.path.join('.')),
        )
      : block.leaves
  const withRows = group.blocks
    .map((b) => ({ ...b, rows: rowsOf(b) }))
    .filter((b) => b.rows.length > 0)
  if (!withRows.length) return null
  const displayed = withRows.find((b) => b.key === active) ?? withRows[0]
  const leafSeg = group.path[group.path.length - 1]
  return (
    // Groups separate with a light hairline that bleeds to the card edges
    // (negative margins undo the card padding); the card's last group closes
    // clean (the wrapper in the file card makes :last-child reliable).
    <div className="-mx-3.5 mt-2.5 border-b border-border/60 px-3.5 pb-2.5 last:border-b-0 last:pb-0">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1 truncate text-xs text-muted-foreground">
          {group.path.slice(0, -1).map((seg, i) => (
            <span key={i} className="flex items-center gap-1">
              {seg} <span className="text-muted-foreground/60">›</span>
            </span>
          ))}
          <span className="font-medium text-foreground">{leafSeg ?? 'root'}</span>
        </span>
        {/* Shown whenever there is a choice to make OR the one block on screen
            is not `base`. Gated on `> 1` alone it disappeared exactly when it
            mattered most: a group whose leaves all come from override blocks,
            or a query that narrows to one, rendered phone/reduced values with
            nothing to say they were overrides — they read as base values, and
            editing them looked like editing the default. A single tab is not
            redundant; it is the label. */}
        {(withRows.length > 1 || displayed.key !== 'base') && (
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
      {(() => {
        // One leaf can be overridden in BOTH spellings at once —
        // `claim.reduced.amount` AND `reduced.claim.amount`. Both fold to this
        // group, this block, and the same name, so they render as two
        // identical rows and only one of them does anything: `resolveNode`
        // merges the colocated block while descending and the hoisted one at
        // the outer level afterwards, so the HOISTED value lands last and
        // wins. Editing the other row changes a number nothing reads.
        //
        // Marked rather than hidden: the dead value is really in the file, and
        // the fix is to delete it there, which the reader cannot be told to do
        // if the row is not shown.
        const liveIndexFor = new Map<string, number>()
        for (const leaf of displayed.rows) {
          const name = leaf.path[leaf.path.length - 1]
          const depth = leaf.path.findIndex((seg) => seg === displayed.key)
          const best = liveIndexFor.get(name)
          if (best === undefined || depth < best) liveIndexFor.set(name, depth)
        }
        return displayed.rows.map((leaf) => {
          const key = leaf.path.join('.')
          const name = leaf.path[leaf.path.length - 1]
          const depth = leaf.path.findIndex((seg) => seg === displayed.key)
          const shadowed =
            displayed.rows.filter((l) => l.path[l.path.length - 1] === name).length > 1 &&
            depth > (liveIndexFor.get(name) ?? depth)
          return (
            <div
              key={key}
              className={shadowed ? 'opacity-40' : undefined}
              title={
                shadowed
                  ? `Overridden twice — the hoisted spelling of "${name}" wins, so this value is never read. Delete one of them.`
                  : undefined
              }
            >
              <LeafRow
                leaf={leaf}
                dirty={dirtySet.has(key)}
                declared={declared}
                options={optionsFor?.(leaf) ?? null}
                onChange={(value) => onChange(leaf, value)}
                onReset={() => onReset(leaf)}
              />
            </div>
          )
        })
      })()}
    </div>
  )
}

/**
 * The project's color variables, read from the live stylesheet.
 *
 * Walking the CSSOM rather than keeping a list: a list would be a second copy
 * of the project's tokens file, and the first time somebody added a color
 * without updating it this panel would start lying. Same-origin sheets only —
 * a cross-origin one throws on `.cssRules`, so the try/catch is load-bearing.
 *
 * `--type-*` is skipped: those are the type system's, and they have their own
 * tab where they are editable rather than merely listed.
 */
function useRootColors(): Array<[string, string]> {
  const [vars, setVars] = useState<Array<[string, string]>>([])
  useEffect(() => {
    const names = new Set<string>()
    for (const sheet of Array.from(document.styleSheets)) {
      let rules: CSSRuleList
      try {
        rules = sheet.cssRules
      } catch {
        continue
      }
      for (const rule of Array.from(rules)) {
        if (!(rule instanceof CSSStyleRule) || rule.selectorText !== ':root') continue
        for (const property of Array.from(rule.style))
          if (property.startsWith('--') && !property.startsWith('--type-'))
            names.add(property)
      }
    }
    const computed = getComputedStyle(document.documentElement)
    setVars(
      [...names]
        .map((name) => [name, computed.getPropertyValue(name).trim()] as [string, string])
        // Colors only: an easing curve and a column count are tokens too, but
        // they are not swatches.
        .filter(([, value]) => /^(#|rgb|hsl|oklch|lab|lch|color\()/i.test(value))
        .sort(),
    )
  }, [])
  return vars
}

/**
 * Colors — READ-ONLY, and labeled as such.
 *
 * Colors are CSS custom properties in a stylesheet, not a token module, so
 * there is nothing here to write back to: the overlay's whole save path is an
 * AST edit of a default-exported literal, and a `.scss` file is not that.
 * Listing them is still worth a tab — it is the fastest way to find the name
 * of the color you are looking at — but the panel must not imply an editor it
 * does not have. Click a swatch to copy its `var()` reference.
 */
function ColorsCard() {
  const colors = useRootColors()
  const [copied, setCopied] = useState<string | null>(null)
  useEffect(() => {
    if (!copied) return undefined
    const id = setTimeout(() => setCopied(null), 1200)
    return () => clearTimeout(id)
  }, [copied])

  return (
    <div className="rounded-xl bg-background p-3.5">
      <SectionTitle>Colors</SectionTitle>
      <div className="mt-1.5 text-[11px] text-muted-foreground">
        {colors.length
          ? 'Read from the :root custom properties — click one to copy its var(). Not editable here: colors live in a stylesheet, not a token module.'
          : 'No color custom properties on :root. Declare them in your tokens stylesheet and they appear here.'}
      </div>
      {colors.length > 0 && (
        <div className="mt-2.5 flex flex-col">
          {colors.map(([name, value]) => (
            <button
              key={name}
              className="-mx-1 flex cursor-pointer items-center gap-2 rounded-lg px-1 py-1 text-left hover:bg-muted"
              title={`copy var(${name})`}
              onClick={() => {
                void navigator.clipboard?.writeText(`var(${name})`)
                setCopied(name)
              }}
            >
              <span
                className="size-5 shrink-0 rounded-full ring-1 ring-foreground/15 ring-inset"
                style={{ background: value }}
              />
              <span className="min-w-0 flex-1 truncate text-xs">{name}</span>
              <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
                {copied === name ? 'copied' : value}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function Overlay() {
  const handle = useHandle()
  const [open, setOpen] = useState(false)
  const [loop, setLoop] = useState(false)
  const [filter, setFilter] = useState('')
  const [filterFocus, setFilterFocus] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [status, setStatus] = useState('')
  const [forcedBp, setForcedBp] = useState<string | null>(null)
  const [forcedReduced, setForcedReduced] = useState(false)
  const typing = useTypeMode()
  // Which section the panel is showing. The three are genuinely different
  // jobs — choreographing motion, setting type, reading the palette — and
  // stacking them in one scroll meant the one you wanted was always below
  // the one you didn't.
  const [tab, setTab] = useState<PanelTab>('motion')
  const loopRef = useRef(false)
  loopRef.current = loop

  const version = useSyncExternalStore(
    useCallback((cb) => handle?.tokens.subscribe(cb) ?? (() => {}), [handle]),
    () => handle?.tokens.version ?? 0,
  )

  // Guarded with a default: an older `modulato` next to a newer overlay has
  // no typography channel, and the panel should degrade to no card rather
  // than throw on first render.
  const typeVersion = useSyncExternalStore(
    useCallback((cb: () => void) => handle?.type?.subscribe(cb) ?? (() => {}), [handle]),
    () => handle?.type?.version ?? 0,
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

  // Loop mode: replay one target back-to-back. Which target is whichever
  // Replay button you press while Loop is on — pressing Shell with Loop on
  // means "loop the shell intro", not "play it once under a looping page
  // intro" (that read as the button being dead). Each cycle's wall time is
  // measured and drives the NEXT cycle's progress ring: durations are
  // deterministic, so from the second cycle on the ring tracks the real
  // span (including slow-mo, which stretches wall time).
  const [loopTarget, setLoopTarget] = useState<LoopTarget>('intro')
  const [cycle, setCycle] = useState<{ ms: number | null; n: number }>({ ms: null, n: 0 })
  useEffect(() => {
    if (!loop || !handle) return undefined
    let alive = true
    const run = async () => {
      let prev: number | null = null
      let n = 0
      while (alive && loopRef.current) {
        n += 1
        setCycle({ ms: prev, n })
        const t0 = performance.now()
        if (loopTarget === 'shell') await handle.replayShellIntro()
        else if (loopTarget === 'motions') {
          // replayMotions() just re-creates the contexts and returns; the
          // animations it starts own their own timing, so pace the cycle.
          handle.replayMotions()
          await new Promise((r) => setTimeout(r, 1000))
        } else await handle.replayIntro()
        await new Promise((r) => setTimeout(r, 500))
        prev = performance.now() - t0
      }
    }
    void run()
    return () => {
      alive = false
    }
  }, [loop, handle, loopTarget])

  // With Loop on a press re-aims the loop; with it off it fires once.
  const onReplay = (target: LoopTarget, run: () => void | Promise<void>) => () => {
    if (loop) setLoopTarget(target)
    else void run()
  }

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
  // Guarded: an older `modulato` next to a newer overlay has no ease channel.
  const declaredEases = handle.eases?.list() ?? []
  const overrideKeys = new Set([...bpNames, 'reduced'])
  const blockOrder = ['base', ...bpNames, 'reduced']

  const save = async (file: string) => {
    const changes = handle.tokens.dirty(file)
    if (!changes.length) return
    setStatus('saving…')
    try {
      await saveTokens(file, changes)
      handle.tokens.markSaved(file)
      setStatus(`saved ${file}`)
    } catch (error) {
      setStatus(`save failed: ${String(error)}`)
    }
    setTimeout(() => setStatus(''), 2500)
  }

  const saveType = async () => {
    const changes = handle.type?.dirty(TYPE_FILE) ?? []
    if (!handle.type || !changes.length) return
    setStatus('saving…')
    try {
      await saveTokens(TYPE_FILE, changes)
      handle.type.markSaved(TYPE_FILE)
      setStatus(`saved ${TYPE_FILE}`)
    } catch (error) {
      setStatus(`save failed: ${String(error)}`)
    }
    setTimeout(() => setStatus(''), 2500)
  }

  // Type Mode is reachable without the panel: it is a MODE you enter to look at
  // the page, and making that a two-step trip through a panel that then covers
  // the page was the wrong shape. Only offered when the project has a type.ts —
  // without one every click would answer "this text wears no style", which is
  // a tool that only knows how to say no.
  const hasType = !!handle.type && handle.type.leaves(TYPE_FILE).length > 0

  // `tab` is what was CLICKED; `active` is what can actually be shown. Deleting
  // type.ts while the Typography tab is open must not leave the panel blank.
  const active: PanelTab = tab === 'type' && !hasType ? 'motion' : tab

  return (
    <>
      {/* One row, so the Tt sits beside the launcher instead of being placed
          against it by a hand-counted offset that breaks when either resizes. */}
      <div className="fixed right-3 bottom-3 z-50 flex items-center gap-1.5">
        {hasType && (
          <Button
            variant={typing ? 'default' : 'outline'}
            size="icon-sm"
            className={cn('rounded-full shadow-lg', !typing && 'bg-background')}
            title={
              typing
                ? 'type inspection on — click any text to edit its style (Escape leaves)'
                : 'inspect type — click any text on the page to edit the style it is set in'
            }
            aria-label="type inspection"
            aria-pressed={typing}
            onClick={() => typeMode.toggle()}
          >
            {/* The same glyph the on-page badge and the popup header carry,
                so the button and the thing it summons read as one tool. */}
            <TypeIcon className="size-4" />
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          className="rounded-full bg-background text-xs shadow-lg"
          onClick={() => setOpen((o) => !o)}
        >
          {open ? '× Tweak' : '✦ Tweak'}
        </Button>
      </div>
      {open && (
        // data-lenis-prevent: the page's Lenis must not intercept wheel/touch
        // over the panel, or its own scrollbar never moves.
        <div
          className="fixed right-3 bottom-14 z-50 flex max-h-[75vh] w-[320px] flex-col gap-2 overflow-y-auto overscroll-contain rounded-2xl border bg-muted p-2 text-xs shadow-[0_24px_64px_-12px_rgba(0,0,0,0.3)]"
          data-version={version}
          data-lenis-prevent=""
        >
          {/* Sections, not one scroll. Only the tabs that have something
              behind them: a project with no type.ts gets no Typography tab
              rather than an empty one. */}
          <div className="flex items-center justify-center gap-4 pt-1 pb-0.5">
            {(
              [
                ['motion', 'Motion'],
                ...(hasType ? ([['type', 'Typography']] as Array<[PanelTab, string]>) : []),
                ['colors', 'Colors'],
              ] as Array<[PanelTab, string]>
            ).map(([id, label]) => (
              <button
                key={id}
                className={cn(
                  'cursor-pointer text-[13px] transition-colors',
                  active === id
                    ? 'font-medium text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
                aria-pressed={active === id}
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
          </div>

          {active === 'motion' && (
            <>
            {/* ── replay: what to play ─────────────────────────────────── */}
            <div className="rounded-xl bg-background p-3.5">
              <div className="mb-2.5 flex items-center justify-between">
                <SectionTitle>Replay</SectionTitle>
                <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                  <Switch size="sm" checked={loop} onCheckedChange={(c: boolean) => setLoop(c === true)} />
                  Loop
                </label>
              </div>
              <div className="flex gap-1.5">
                {/* The ring marks the button the loop is currently aimed at. */}
                {(
                  [
                    ['intro', 'Intro', () => handle.replayIntro()],
                    ['shell', 'Shell', () => handle.replayShellIntro()],
                    ['motions', 'Motions', () => handle.replayMotions()],
                  ] as Array<[LoopTarget, string, () => void | Promise<void>]>
                ).map(([target, label, run]) => (
                  <Button
                    key={target}
                    size="sm"
                    className="h-9 flex-1 rounded-full text-xs"
                    title={loop ? `loop ${label.toLowerCase()}` : `replay ${label.toLowerCase()}`}
                    onClick={onReplay(target, run)}
                  >
                    {loop && loopTarget === target ? (
                      <LoopRingIcon ms={cycle.ms} n={cycle.n} />
                    ) : (
                      <PlayIcon className="size-2.5" />
                    )}{' '}
                    {label}
                  </Button>
                ))}
              </div>
            </div>

            {/* ── preview context: replays run AS this breakpoint/speed ──── */}
            <div className="rounded-xl bg-background p-3.5">
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
            {/* ── tokens ──────────────────────────────────────────────── */}
            <div className="rounded-xl bg-background p-3.5">
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
                    className="h-9 rounded-full border-border bg-background px-8 text-center text-xs"
                    type="text"
                    value={filter}
                    onFocus={() => setFilterFocus(true)}
                    onBlur={() => setFilterFocus(false)}
                    onChange={(e) => setFilter(e.target.value)}
                  />
                  {/* The placeholder is a centered text+icon cluster, so the
                      magnifier travels with the label instead of hugging the
                      field's edge. */}
                  {!filter && !filterFocus && (
                    <span className="pointer-events-none absolute inset-0 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                      Filter tokens <SearchIcon />
                    </span>
                  )}
                  {filter && (
                    <button
                      className="absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer text-muted-foreground hover:text-foreground"
                      title="clear filter"
                      onClick={() => setFilter('')}
                    >
                      ×
                    </button>
                  )}
                </div>
              )}
            </div>

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
                // The file path is rendered directly above these rows but was
                // not searchable, so in a project with many motion files you
                // could find `duration` and not "everything in the transitions
                // folder" — and typing `transitions` returned nothing at all.
                // A hit here shows the whole file, rows and all.
                const fileHit = !!query && file.toLowerCase().includes(query)
                // A group is named for what it IS in the code; people search for
                // what it DOES on the page. `keywords` lets a file say so —
                // indexed here, shown nowhere.
                const fileKeywords = handle.tokens.keywords(file)
                const keywordHit = (g: TokenGroup) =>
                  !!query &&
                  (fileKeywords[g.path.join('.')] ?? []).some((w) =>
                    w.toLowerCase().includes(query),
                  )
                const groups = groupLeaves(leaves, overrideKeys, blockOrder)
                const groupVisible = (g: TokenGroup) =>
                  fileHit ||
                  keywordHit(g) ||
                  g.blocks.some((b) =>
                    b.leaves.some(
                      (l) =>
                        !query ||
                        rowMatches(query, g.path, l) ||
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
                        <FileStackIcon />
                      </button>
                      <span className="truncate text-[13px] font-semibold">{file}</span>
                    </div>
                    <div>
                      {shownGroups.map((group) => (
                        <GroupSection
                          key={group.path.join('.') || '(root)'}
                          group={group}
                          dirtySet={dirtySet}
                          query={query}
                          groupHit={fileHit || keywordHit(group)}
                          declared={declaredEases}
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
                    </div>
                    <div className="mt-3 flex gap-1.5">
                      <Button
                        size="sm"
                        className="h-9 flex-1 rounded-full text-xs"
                        disabled={!dirtySet.size}
                        onClick={() => void save(file)}
                      >
                        Save{dirtySet.size ? ` (${dirtySet.size})` : ''}
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="h-9 flex-1 rounded-full text-xs"
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
            </>
          )}

          {active === 'type' && (
            <>
            {/* ── typography ──────────────────────────────────────────── */}
            {/* The panel half of Type Mode. The popup on the page edits one
                style where it sits; this is the whole system at once, with the
                breakpoint tabs a click on a heading cannot reach. Both write the
                same registry and save through the same endpoint. */}
            {handle.type && handle.type.leaves(TYPE_FILE).length > 0 && (() => {
              // Font stacks are READ-ONLY here — deliberately not offered.
              //
              // A stack is a comma-separated list of quoted family names, and a
              // free-text box over it turns one stray character into a site that
              // silently falls back to Times: no error, no red, just the wrong
              // face everywhere. Nothing else in this panel can do damage of
              // that shape — a bad number is visible and a slider can be dragged
              // back. Changing a typeface is a decision made once, in type.ts,
              // next to the @font-face or the Typekit link it depends on; it is
              // not a thing to fat-finger while looking at a heading.
              const leaves = handle.type
                .leaves(TYPE_FILE)
                .filter((l) => l.path[0] !== 'fonts')
              // The catalogs the file itself declares. A style's `size` and
              // `font` are KEYS into these, so they are closed sets and belong
              // in a select — typing `lgg` into a text box is not an error, it
              // is `var(--type-size-lgg)` falling back silently.
              const spec = (handle.type.list().find((f) => f.file === TYPE_FILE)
                ?.tokens ?? {}) as {
                fonts?: Record<string, unknown>
                scale?: Record<string, unknown>
              }
              const sizes = Object.entries(spec.scale ?? {}).map(([key, value]) => ({
                value: key,
                // The value beside the key, so choosing a step does not mean
                // remembering what `lg` is worth in this project.
                label: `${key} · ${String(value)}`,
              }))
              const fonts = Object.keys(spec.fonts ?? {}).map((key) => ({
                value: key,
                label: key,
              }))
              // `case` and `wrap` are CSS keyword sets — closed by the language
              // rather than by the file, same silent-typo risk, same treatment.
              const keywords = (list: string[]) =>
                list.map((value) => ({ value, label: value }))
              const typeOptions = (leaf: TokenLeaf) => {
                // Only inside a style (or a per-selector override of one): the
                // `scale` group's own entries are lengths, not keys.
                const root = leaf.path[0]
                if (root !== 'styles' && root !== 'overrides') return null
                switch (leaf.path[leaf.path.length - 1]) {
                  case 'size':
                    return sizes.length ? sizes : null
                  case 'font':
                    return fonts.length ? fonts : null
                  case 'case':
                    return keywords(['none', 'uppercase', 'lowercase', 'capitalize'])
                  case 'wrap':
                    return keywords(['wrap', 'balance', 'pretty', 'nowrap'])
                  default:
                    return null
                }
              }
              const typeDirty = new Set(
                handle.type.dirty(TYPE_FILE).map((l) => l.path.join('.')),
              )
              const query = filter.trim().toLowerCase()
              const groups = groupLeaves(leaves, overrideKeys, blockOrder).filter((g) =>
                g.blocks.some((b) =>
                  b.leaves.some(
                    (l) =>
                      !query ||
                      rowMatches(query, g.path, l) ||
                      typeDirty.has(l.path.join('.')),
                  ),
                ),
              )
              return (
                <div className="rounded-xl bg-background p-3.5" data-version={typeVersion}>
                  <div className="flex items-center justify-between">
                    <SectionTitle>Typography</SectionTitle>
                    <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                      <Switch
                        size="sm"
                        checked={typing}
                        onCheckedChange={(c: boolean) => typeMode.set(c === true)}
                      />
                      Click text
                    </label>
                  </div>
                  {typing && (
                    <div className="mt-1.5 text-[11px] text-muted-foreground">
                      Click any text on the page to edit the style it is set in.
                      Escape closes the card; Escape again leaves the mode.
                    </div>
                  )}
                  <div>
                    {groups.map((group) => (
                      <GroupSection
                        key={group.path.join('.') || '(root)'}
                        group={group}
                        dirtySet={typeDirty}
                        query={query}
                        groupHit={false}
                        declared={[]}
                        optionsFor={typeOptions}
                        onChange={(leaf, value) =>
                          handle.type?.set(TYPE_FILE, leaf.path, value)
                        }
                        onReset={(leaf) => handle.type?.resetLeaf(TYPE_FILE, leaf.path)}
                      />
                    ))}
                  </div>
                  <div className="mt-3 flex gap-1.5">
                    <Button
                      size="sm"
                      className="h-9 flex-1 rounded-full text-xs"
                      disabled={!typeDirty.size}
                      onClick={() => void saveType()}
                    >
                      Save{typeDirty.size ? ` (${typeDirty.size})` : ''}
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="h-9 flex-1 rounded-full text-xs"
                      disabled={!typeDirty.size}
                      onClick={() => handle.type?.reset(TYPE_FILE)}
                    >
                      Reset
                    </Button>
                  </div>
                </div>
              )
            })()}
            </>
          )}

          {active === 'colors' && <ColorsCard />}

          {status && <div className="px-2 pb-1 text-[11px] text-muted-foreground">{status}</div>}
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
  // font-size INHERITS across the shadow boundary from the host page — pin
  // the base so em values and any unstyled text ignore the host's type
  // scale (the compiled CSS is already rem-free for the same reason).
  root.style.fontSize = '16px'
  shadow.appendChild(root)
  void import('react-dom/client').then(({ createRoot }) => {
    createRoot(root).render(
      <>
        <Overlay />
        <Inspect />
        <TypeMode />
      </>,
    )
  })
}
