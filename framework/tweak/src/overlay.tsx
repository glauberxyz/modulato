import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from 'react'
import type { ModulatoDevHandle } from 'modulato/client'
import type { TokenLeaf, TokenValue } from 'modulato'

const S: Record<string, CSSProperties> = {
  toggle: {
    position: 'fixed',
    right: 12,
    bottom: 12,
    zIndex: 99999,
    font: '600 11px/1 ui-monospace, monospace',
    padding: '8px 10px',
    borderRadius: 999,
    border: '1px solid rgba(255,255,255,0.2)',
    background: 'rgba(20,20,24,0.92)',
    color: '#eee',
    cursor: 'pointer',
  },
  panel: {
    position: 'fixed',
    right: 12,
    bottom: 48,
    zIndex: 99999,
    width: 340,
    maxHeight: '70vh',
    overflowY: 'auto',
    overscrollBehavior: 'contain',
    font: '11px/1.5 ui-monospace, monospace',
    background: 'rgba(20,20,24,0.94)',
    color: '#ddd',
    border: '1px solid rgba(255,255,255,0.14)',
    borderRadius: 10,
    padding: 10,
    backdropFilter: 'blur(8px)',
  },
  row: { display: 'flex', alignItems: 'center', gap: 6, margin: '2px 0' },
  label: {
    flex: 1,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    color: '#9a9aa2',
  },
  input: {
    width: 46,
    font: 'inherit',
    background: 'rgba(255,255,255,0.07)',
    color: '#fff',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 4,
    padding: '2px 5px',
  },
  slider: {
    width: 86,
    margin: 0,
    accentColor: '#8fa8ff',
  },
  button: {
    font: 'inherit',
    background: 'rgba(255,255,255,0.08)',
    color: '#eee',
    border: '1px solid rgba(255,255,255,0.16)',
    borderRadius: 5,
    padding: '3px 8px',
    cursor: 'pointer',
  },
  file: {
    margin: '10px 0 4px',
    padding: '4px 0',
    borderTop: '1px solid rgba(255,255,255,0.1)',
    color: '#fff',
    fontWeight: 600,
  },
  controls: { display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 6 },
}

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

function NumberRow({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (value: number) => void
}) {
  // Bounds are frozen at mount so the scale never shifts mid-drag.
  const [range] = useState(() => sliderRange(value))
  // Draft while the box is focused — external updates (reset, breakpoint
  // force) flow straight through when not editing. No value-derived key:
  // remounting a focused input is what caused the per-keystroke blur.
  const [draft, setDraft] = useState<string | null>(null)
  return (
    <div style={S.row}>
      <span style={S.label} title={label}>
        {label}
      </span>
      <input
        type="range"
        style={S.slider}
        min={Math.min(range.min, value)}
        max={Math.max(range.max, value)}
        step={range.step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <input
        style={S.input}
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
    </div>
  )
}

function TextRow({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  const [draft, setDraft] = useState<string | null>(null)
  return (
    <div style={S.row}>
      <span style={S.label} title={label}>
        {label}
      </span>
      <input
        style={{ ...S.input, width: 108 }}
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
    </div>
  )
}

function LeafRow({
  leaf,
  onChange,
}: {
  leaf: TokenLeaf
  onChange: (value: TokenValue) => void
}) {
  const label = leaf.path.join('.')
  if (typeof leaf.value === 'boolean')
    return (
      <div style={S.row}>
        <span style={S.label} title={label}>
          {label}
        </span>
        <input
          type="checkbox"
          checked={leaf.value}
          onChange={(e) => onChange(e.target.checked)}
        />
      </div>
    )
  if (typeof leaf.value === 'number')
    return <NumberRow label={label} value={leaf.value} onChange={onChange} />
  return <TextRow label={label} value={leaf.value} onChange={onChange} />
}

function Overlay() {
  const handle = useHandle()
  const [open, setOpen] = useState(false)
  const [loop, setLoop] = useState(false)
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
  const files = handle.tokens.list()

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
      <button style={S.toggle} onClick={() => setOpen((o) => !o)}>
        {open ? '× motion' : '✦ motion'}
      </button>
      {open && (
        // data-lenis-prevent: the page's Lenis must not intercept wheel/touch
        // over the panel, or its own scrollbar never moves.
        <div style={S.panel} data-version={version} data-lenis-prevent="">
          <div style={S.controls}>
            <button style={S.button} onClick={() => void handle.replayIntro()}>
              replay intro
            </button>
            <button style={S.button} onClick={() => void handle.replayShellIntro()}>
              shell
            </button>
            <button style={S.button} onClick={() => handle.replayMotions()}>
              motions
            </button>
            <label style={{ ...S.row, cursor: 'pointer' }}>
              <input type="checkbox" checked={loop} onChange={(e) => setLoop(e.target.checked)} />
              loop
            </label>
          </div>
          <div style={S.controls}>
            {/* Preview another breakpoint's resolved tokens without resizing. */}
            {[null, ...handle.viewport.names()].map((name) => (
              <button
                key={name ?? 'auto'}
                style={{
                  ...S.button,
                  background:
                    forcedBp === name ? 'rgba(120,160,255,0.3)' : S.button.background,
                }}
                onClick={() => {
                  setForcedBp(name)
                  handle.viewport.force(name)
                  queueReplay()
                }}
              >
                {name ?? 'auto'}
              </button>
            ))}
            <label style={{ ...S.row, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={forcedReduced}
                onChange={(e) => {
                  setForcedReduced(e.target.checked)
                  handle.viewport.forceReduced(e.target.checked ? true : null)
                  queueReplay()
                }}
              />
              reduced
            </label>
          </div>
          <div style={S.controls}>
            {[1, 0.5, 0.25, 0.1].map((s) => (
              <button
                key={s}
                style={{
                  ...S.button,
                  background: handle.speed === s ? 'rgba(120,160,255,0.3)' : S.button.background,
                }}
                onClick={() => {
                  handle.setSpeed(s)
                  setStatus(s === 1 ? '' : `${s}× speed`)
                }}
              >
                {s}×
              </button>
            ))}
          </div>
          {!files.length && (
            <div style={{ color: '#9a9aa2' }}>
              no motion tokens registered — create a motion.ts next to a page and read it
              from your intro/useMotion code.
            </div>
          )}
          {files.map(({ file }) => {
            const leaves = handle.tokens.leaves(file)
            const dirty = handle.tokens.dirty(file).length
            return (
              <div key={file}>
                <div style={S.file}>
                  {file}
                  {dirty ? ` · ${dirty} unsaved` : ''}
                </div>
                {leaves.map((leaf) => (
                  <LeafRow
                    key={leaf.path.join('.')}
                    leaf={leaf}
                    onChange={(value) => {
                      handle.tokens.set(file, leaf.path, value)
                      queueReplay()
                    }}
                  />
                ))}
                <div style={{ ...S.controls, marginTop: 4 }}>
                  <button style={S.button} disabled={!dirty} onClick={() => void save(file)}>
                    save{dirty ? ` (${dirty})` : ''}
                  </button>
                  <button
                    style={S.button}
                    disabled={!dirty}
                    onClick={() => {
                      handle.tokens.reset(file)
                      queueReplay()
                    }}
                  >
                    reset
                  </button>
                </div>
              </div>
            )
          })}
          {status && <div style={{ marginTop: 6, color: '#8fc' }}>{status}</div>}
        </div>
      )}
    </>
  )
}

/** Mount the Tweak overlay (idempotent). Called by the dev client entry. */
export function mount(): void {
  if (typeof document === 'undefined') return
  if (document.getElementById('__modulato-tweak')) return
  const host = document.createElement('div')
  host.id = '__modulato-tweak'
  document.body.appendChild(host)
  void import('react-dom/client').then(({ createRoot }) => {
    createRoot(host).render(<Overlay />)
  })
}
