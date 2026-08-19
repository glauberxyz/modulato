import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Inspect mode: hold Option (Alt) and click any element to open the line that
 * authored it in your editor.
 *
 * The @modulato/vite plugin stamps `data-modulato-source="/pages/home/page.tsx:78:9"`
 * on every host element in dev. This is the half that makes it a tool rather
 * than a string you read in devtools and retype.
 *
 * Option-click is the convention the React ecosystem already settled on
 * (click-to-component, and the same chord in several devtools), so it is the
 * one gesture a person is likely to try without being told.
 *
 * TWO SEPARATE THINGS, deliberately not sharing a switch:
 *
 * - Swallowing the click reads the modifier off the EVENT, every time. Never
 *   off remembered state.
 * - The outline is the only thing that remembers, because it has to survive
 *   between events.
 *
 * They were one flag at first, and that was a bug with teeth. Opening a file
 * cleared the flag while Option was still physically down, and a held modifier
 * sends no second keydown — so the next click of the same chord was no longer
 * intercepted, and Option-click on a link is the browser's "download the
 * target". The tool went quiet and the browser started saving files. Anything
 * that clears the outline — the editor stealing focus, a tab away, a failed
 * open — could do the same, so the fix is not a better disarm rule: it is
 * making interception hold no state that could be stale.
 */

const ATTR = 'data-modulato-source'
/** The overlay's own shadow host. Its contents are ours, not the site's. */
const OVERLAY_HOST = '__modulato-tweak'

interface Hit {
  at: string
  rect: DOMRect
}

/**
 * Typing an Option-character into a field is not an attempt to inspect.
 *
 * `activeElement` retargets to the shadow HOST, so a focused field inside a
 * shadow tree reads as the host `<div>` and passes the check. The Tweak panel's
 * own inputs live in exactly such a tree, so walk in.
 */
function isTyping(): boolean {
  let el: Element | null = document.activeElement
  while (el?.shadowRoot?.activeElement) el = el.shadowRoot.activeElement
  if (!(el instanceof HTMLElement)) return false
  return el.isContentEditable || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA'
}

/**
 * The stamped ancestor of whatever is under the cursor.
 *
 * `closest` rather than the node itself because the attribute lands on host
 * elements: the cursor is often over a text node's parent that has one, but it
 * can equally be over an SVG child or a pseudo-element's owner that does not.
 * Walking up finds the nearest thing that can actually name a file.
 */
function resolve(x: number, y: number): Hit | null {
  const under = document.elementFromPoint(x, y)
  if (!under) return null
  // Composed events retarget to the shadow host, so this one check covers
  // everything the overlay itself renders.
  if (under.closest(`#${OVERLAY_HOST}`)) return null
  const el = under.closest(`[${ATTR}]`)
  const at = el?.getAttribute(ATTR)
  if (!el || !at) return null
  return { at, rect: el.getBoundingClientRect() }
}

export function Inspect() {
  const [armed, setArmed] = useState(false)
  const [hit, setHit] = useState<Hit | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const pointer = useRef({ x: -1, y: -1 })
  // Read by listeners that are mounted for the component's whole life, so they
  // must not close over a stale render's value.
  const armedRef = useRef(false)

  const arm = useCallback((on: boolean) => {
    armedRef.current = on
    setArmed(on)
    if (!on) setHit(null)
  }, [])

  const refresh = useCallback(() => {
    const { x, y } = pointer.current
    setHit(armedRef.current && x >= 0 ? resolve(x, y) : null)
  }, [])

  const open = useCallback(async (at: string) => {
    try {
      // Resolved server-side against the Vite root: the attribute is
      // root-relative, and Vite's own endpoint resolves against cwd.
      const res = await fetch(`/__modulato/open?at=${encodeURIComponent(at)}`)
      const body = (await res.json()) as { ok: boolean; file?: string; error?: string }
      if (!body.ok || !body.file) throw new Error(body.error ?? `HTTP ${res.status}`)
      await fetch(`/__open-in-editor?file=${encodeURIComponent(body.file)}`)
      setNote(at)
    } catch (error) {
      setNote(`could not open: ${error instanceof Error ? error.message : String(error)}`)
    }
  }, [])

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      pointer.current = { x: e.clientX, y: e.clientY }
      // Coming back from the editor with Option still held sends no keydown —
      // the press happened while another window had focus. Take the modifier
      // off the event instead, so the outline returns on the first movement.
      if (e.altKey && !armedRef.current && !isTyping()) arm(true)
      if (armedRef.current) refresh()
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return arm(false)
      if (e.key !== 'Alt' || e.repeat || isTyping()) return
      // Nothing to inspect: say why, rather than arming into a mode where
      // every click silently does nothing.
      if (!document.querySelector(`[${ATTR}]`)) {
        setNote('No source attributes in this page — is sourceAttribute off?')
        return
      }
      arm(true)
      refresh()
    }
    // Also fires for the Option key itself; `altKey` is already false by then.
    const onKeyUp = (e: KeyboardEvent) => {
      if (!e.altKey) arm(false)
    }
    const onVisibility = () => {
      if (document.hidden) arm(false)
    }
    const onBlur = () => arm(false)

    // Capture, so the site's own handlers never see the chord. Swallowing the
    // click is also what stops Option-click doing what the BROWSER does with
    // it — on a link that is "download the target".
    const intercept = (e: MouseEvent) => {
      if (!e.altKey || isTyping()) return null
      const found = resolve(e.clientX, e.clientY)
      // Nothing stamped under the cursor: let the click be an ordinary click
      // rather than eating it for no result.
      if (!found) return null
      e.preventDefault()
      e.stopPropagation()
      return found
    }
    const onClick = (e: MouseEvent) => {
      const found = intercept(e)
      if (!found) return
      // Deliberately does NOT disarm. The chord is still held, and the next
      // click of it must be intercepted too.
      setHit(null)
      void open(found.at)
    }
    // Prevents focus, text selection and image dragging before the click ever
    // lands — the visible artefacts of a chord meant for something else.
    const onDown = (e: MouseEvent) => void intercept(e)
    const onDrag = (e: DragEvent) => {
      if (e.altKey) e.preventDefault()
    }

    window.addEventListener('pointermove', onMove, { passive: true, capture: true })
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('click', onClick, true)
    window.addEventListener('mousedown', onDown, true)
    window.addEventListener('dragstart', onDrag, true)
    return () => {
      window.removeEventListener('pointermove', onMove, true)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('click', onClick, true)
      window.removeEventListener('mousedown', onDown, true)
      window.removeEventListener('dragstart', onDrag, true)
    }
  }, [arm, refresh, open])

  // Only the outline follows the page; interception above is independent of it.
  useEffect(() => {
    if (!armed) return undefined
    refresh()
    window.addEventListener('scroll', refresh, { passive: true, capture: true })
    window.addEventListener('resize', refresh, { passive: true })
    return () => {
      window.removeEventListener('scroll', refresh, true)
      window.removeEventListener('resize', refresh)
    }
  }, [armed, refresh])

  useEffect(() => {
    if (!note) return undefined
    const id = setTimeout(() => setNote(null), 3000)
    return () => clearTimeout(id)
  }, [note])

  if (!hit && !note) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2147483646,
        pointerEvents: 'none',
        // A fixed layer covering the viewport must never become a scroll area
        // of its own, whatever the label's clamping does at the edges.
        overflow: 'hidden',
        font: '500 11px/1.4 "Inter Tweak", ui-sans-serif, system-ui, sans-serif',
      }}
    >
      {hit && (
        <>
          <div
            style={{
              position: 'absolute',
              top: hit.rect.top,
              left: hit.rect.left,
              width: hit.rect.width,
              height: hit.rect.height,
              // The overlay's palette is deliberately achromatic, so the
              // marker is too: a white line sandwiched in black reads on any
              // background a site might put behind it, without inventing an
              // accent colour the rest of the tool does not have.
              boxShadow:
                '0 0 0 1px oklch(0.15 0 0), inset 0 0 0 1px oklch(0.15 0 0), 0 0 0 2px oklch(0.99 0 0), 0 0 0 3px oklch(0.15 0 0)',
            }}
          />
          <Label rect={hit.rect} text={hit.at} />
        </>
      )}
      {note && (
        <div
          style={{
            position: 'absolute',
            bottom: 12,
            left: '50%',
            transform: 'translateX(-50%)',
            maxWidth: 'calc(100% - 24px)',
            padding: '5px 9px',
            borderRadius: 6,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            background: 'oklch(0.15 0 0)',
            color: 'oklch(0.99 0 0)',
          }}
        >
          {note}
        </div>
      )}
    </div>
  )
}

/**
 * Sits above the marked element, or below it when the element is near the top
 * of the viewport — a label that renders off-screen names nothing.
 *
 * Past the halfway mark it hangs off the element's RIGHT edge and grows
 * leftwards. Anchoring left and truncating would clip the tail, and the tail is
 * `:line:col` — the part you came for. `nowrap` text is never narrower than its
 * content, so a max-width would not have produced an ellipsis anyway; it would
 * just have been cut off by the layer's overflow with nothing to signal it.
 */
function Label({ rect, text }: { rect: DOMRect; text: string }) {
  const above = rect.top >= 22
  // The layer is `fixed; inset: 0`, so its box is the LAYOUT viewport — which
  // excludes a classic scrollbar gutter, unlike innerWidth / 100vw.
  const vw = document.documentElement.clientWidth
  const fromRight = rect.left > vw / 2
  return (
    <div
      style={{
        position: 'absolute',
        top: above ? rect.top - 22 : Math.min(rect.bottom + 4, window.innerHeight - 22),
        ...(fromRight
          ? { right: Math.max(0, vw - rect.right) }
          : { left: Math.max(0, rect.left) }),
        // Percentage of the layer, so it agrees with the box above.
        maxWidth: '100%',
        padding: '2px 6px',
        borderRadius: 4,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        background: 'oklch(0.15 0 0)',
        color: 'oklch(0.99 0 0)',
      }}
    >
      {text}
    </div>
  )
}
