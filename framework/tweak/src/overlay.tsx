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
    width: 300,
    maxHeight: '70vh',
    overflowY: 'auto',
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
    width: 76,
    font: 'inherit',
    background: 'rgba(255,255,255,0.07)',
    color: '#fff',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 4,
    padding: '2px 5px',
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
  return (
    <div style={S.row}>
      <span style={S.label} title={label}>
        {label}
      </span>
      <input
        style={S.input}
        type={typeof leaf.value === 'number' ? 'number' : 'text'}
        step={typeof leaf.value === 'number' && Math.abs(leaf.value) < 10 ? 0.05 : 1}
        defaultValue={String(leaf.value)}
        key={`${label}:${String(leaf.value)}`}
        onChange={(e) => {
          if (typeof leaf.value === 'number') {
            const parsed = Number(e.target.value)
            if (!Number.isNaN(parsed)) onChange(parsed)
          } else {
            onChange(e.target.value)
          }
        }}
      />
    </div>
  )
}

function Overlay() {
  const handle = useHandle()
  const [open, setOpen] = useState(false)
  const [loop, setLoop] = useState(false)
  const [status, setStatus] = useState('')
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
        <div style={S.panel} data-version={version}>
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
