import { getMotionSpeed } from 'modulato'
import { DEV, loadImage, warnOnce } from './common'
import { createGpu } from './gpu'
import { onLateFrame } from './late'
import { PLANE_GLSL, PLANE_WGSL } from './plane-shaders'
import { isShader } from './shader'
import type {
  FragmentInput,
  Gpu,
  GpuOptions,
  Pass,
  Rect,
  Shader,
  ShaderSource,
  Texture,
  TextureSource,
} from './types'

/** What a plane's `uniforms` function is handed every frame. */
export interface PlaneFrame {
  /** Seconds on the motion clock — Tweak's slow-mo slows it. */
  time: number
  /** Seconds since the last frame, same clock. */
  delta: number
  /** Where the element is, in CSS pixels from the viewport's top-left. */
  rect: Rect
  /** The pointer over the plane in its own uv — 0→1, bottom-up; outside 0–1 when it is elsewhere. */
  pointer: [number, number]
}

export interface PlaneOptions {
  /**
   * The shader to draw with. Default: the element's image as CSS would show
   * it — `object-fit`, `border-radius`, opacity — so a plane with no shader
   * looks like the element it replaces.
   */
  fragment?: FragmentInput
  /**
   * What `image` samples. `'element'` (the default for `<img>`, `<video>` and
   * `<canvas>`) uploads the element itself; a URL — an `SdfAsset`'s `url`,
   * say — is loaded; any other source is uploaded as given; `null` binds
   * nothing.
   */
  texture?: 'element' | string | TextureSource | null
  /** Uniforms for the shader — an object, or a function called every frame. */
  uniforms?: Readonly<Record<string, unknown>> | ((frame: PlaneFrame) => Readonly<Record<string, unknown>>)
  /**
   * Build mipmaps for the texture, so it stays sharp drawn smaller than it
   * is — a thumbnail, or a transition shrinking it. Default `true`.
   */
  mipmaps?: boolean
  /**
   * Re-upload the element every frame. A playing `<video>` always is; set this
   * for a `<canvas>` something else keeps drawing into.
   */
  live?: boolean
}

interface PlaneRecord {
  element: HTMLElement
  options: { current: PlaneOptions }
  setLive(live: boolean): void
}

interface Attached {
  record: PlaneRecord
  pass: Pass | null
  texture: Texture | null
  textureReady: boolean
  /** Inline `filter` before the stage hid the element — restored on detach. */
  previousFilter: string | null
  live: boolean
  failed: boolean
  cleanup: (() => void)[]
}

const records = new Set<PlaneRecord>()
let active: Stage | null = null

/** Called by `usePlane`. The plane is drawn by whichever stage is mounted. */
export function registerPlane(record: PlaneRecord): () => void {
  records.add(record)
  active?.attach(record)
  return () => {
    records.delete(record)
    active?.detach(record)
  }
}

export interface StageOptions extends GpuOptions {}

export interface Stage {
  readonly gpu: Gpu
  attach(record: PlaneRecord): void
  detach(record: PlaneRecord): void
  dispose(): void
}

// Inline shader sources need a stable identity for the pass cache key.
const ids = new WeakMap<object, number>()
let nextId = 1
function keyOf(source: ShaderSource | undefined): string {
  if (!source) return '-'
  if (typeof source === 'string') return source
  let id = ids.get(source)
  if (!id) ids.set(source, (id = nextId++))
  return `#${id}`
}
function fragmentKey(input: FragmentInput): string {
  if (typeof input === 'string' || isShader(input)) return keyOf(input as ShaderSource)
  return `${keyOf(input.wgsl)}|${keyOf(input.glsl)}`
}

const DEFAULT_FRAGMENT: { wgsl: Shader; glsl: Shader } = {
  wgsl: { lang: 'wgsl', code: PLANE_WGSL, version: 0, id: '@modulato/gpu/plane.wgsl' },
  glsl: { lang: 'glsl', code: PLANE_GLSL, version: 0, id: '@modulato/gpu/plane.frag' },
}

function intersect(a: Rect, b: Rect): Rect | null {
  const x = Math.max(a.x, b.x)
  const y = Math.max(a.y, b.y)
  const r = Math.min(a.x + a.width, b.x + b.width)
  const bottom = Math.min(a.y + a.height, b.y + b.height)
  return r > x && bottom > y ? { x, y, width: r - x, height: bottom - y } : null
}

/** `a` minus `b`: up to four rects covering what of `a` lies outside `b`. */
function subtract(a: Rect, b: Rect): Rect[] {
  const i = intersect(a, b)
  if (!i) return [a]
  const out: Rect[] = []
  if (i.y > a.y) out.push({ x: a.x, y: a.y, width: a.width, height: i.y - a.y })
  if (i.y + i.height < a.y + a.height)
    out.push({ x: a.x, y: i.y + i.height, width: a.width, height: a.y + a.height - (i.y + i.height) })
  if (i.x > a.x) out.push({ x: a.x, y: i.y, width: i.x - a.x, height: i.height })
  if (i.x + i.width < a.x + a.width)
    out.push({ x: i.x + i.width, y: i.y, width: a.x + a.width - (i.x + i.width), height: i.height })
  return out
}

const toRect = (r: DOMRect): Rect => ({ x: r.left, y: r.top, width: r.width, height: r.height })

/** Every page wrapper in the outlet — one, or two during a transition. */
function mountedPages(): HTMLElement[] {
  const outlet = document.querySelector('[data-modulato-outlet]')
  return outlet ? ([...outlet.children] as HTMLElement[]).filter((c) => c.hasAttribute('data-page')) : []
}

/** The page wrapper an element belongs to, or null for the shell. */
function pageOf(element: Element): HTMLElement | null {
  for (let n = element.parentElement; n; n = n.parentElement)
    if (n.hasAttribute('data-page') && n.parentElement?.hasAttribute('data-modulato-outlet')) return n
  return null
}

/**
 * Where a page sits in the stack: the outgoing page is lifted to z-index 1
 * over the incoming one during a transition; otherwise later is on top.
 */
function rankOf(page: HTMLElement | null): number {
  if (!page) return Number.MAX_SAFE_INTEGER
  const z = parseInt(getComputedStyle(page).zIndex, 10)
  const index = page.parentElement ? Array.prototype.indexOf.call(page.parentElement.children, page) : 0
  return (Number.isFinite(z) ? z : 0) * 1000 + index
}

interface Look {
  opacity: number
  /** The viewport ∩ every clipping ancestor's padding box. */
  clip: Rect | null
}

/**
 * What the DOM does to an element on its way to the screen that a plane has
 * to copy: the product of every ancestor's opacity (GSAP fades, WAAPI page
 * crossfades), and the clip of every ancestor that hides overflow (masks,
 * reveals, carousels). Rotation, skew, `clip-path` and filters are NOT
 * mirrored — MODULATO.md says so, and in dev `warnUncopied` says where.
 */
function look(element: HTMLElement, viewport: Rect, audit = false): Look {
  let opacity = 1
  let clip: Rect | null = viewport
  for (let n: HTMLElement | null = element; n && n !== document.documentElement; n = n.parentElement) {
    const style = getComputedStyle(n)
    if (DEV && audit) warnUncopied(element, n, style)
    if (n === element && style.visibility === 'hidden') return { opacity: 0, clip: null }
    opacity *= parseFloat(style.opacity) || 0
    if (opacity <= 0) return { opacity: 0, clip: null }
    if (n !== element && (style.overflowX !== 'visible' || style.overflowY !== 'visible')) {
      const r = n.getBoundingClientRect()
      clip = clip && intersect(clip, { x: r.left + n.clientLeft, y: r.top + n.clientTop, width: n.clientWidth, height: n.clientHeight })
      if (!clip) return { opacity: 0, clip: null }
    }
  }
  return { opacity, clip }
}

/** A tag to find an element by in a console message: `<img src="press.jpg">`. */
function describe(element: Element): string {
  const src = element.getAttribute('src')?.split(/[?#]/)[0].split('/').pop()
  const name = element.id
    ? ` id="${element.id}"`
    : src
      ? ` src="${src}"`
      : element.classList.length
        ? ` class="${element.classList[0]}"`
        : ''
  return `<${element.localName}${name}>`
}

/**
 * True when a computed `transform` does more than move and scale: a plane
 * fills its element's bounding box upright, so a rotation, skew, mirror or
 * perspective is lost.
 */
function bends(transform: string): boolean {
  if (transform === 'none') return false
  const m = transform.slice(transform.indexOf('(') + 1).split(',').map(parseFloat)
  if (transform.startsWith('matrix3d'))
    return [1, 2, 3, 4, 6, 7, 8, 9, 11].some((i) => Math.abs(m[i]) > 1e-6) || m[0] < 0 || m[5] < 0
  return Math.abs(m[1]) > 1e-6 || Math.abs(m[2]) > 1e-6 || m[0] < 0 || m[3] < 0
}

/**
 * Dev only: CSS on a plane, or on one of its ancestors, that changes how the
 * element looks but that the stage does not copy — the GPU would draw it
 * without, and nothing else would say so. Once per element and property.
 * The plane's own `filter` is checked on attach: by now it is the stage's.
 */
function warnUncopied(element: HTMLElement, n: HTMLElement, style: CSSStyleDeclaration): void {
  const own = n === element
  const lost: string[] = []
  if (bends(style.transform)) lost.push('a rotation, skew or mirror (`transform`)')
  if (style.clipPath && style.clipPath !== 'none') lost.push('`clip-path`')
  const mask = style.maskImage || style.webkitMaskImage
  if (mask && mask !== 'none') lost.push('a `mask`')
  if (!own && style.filter && style.filter !== 'none') lost.push('a CSS `filter`')
  if (own && style.objectPosition && style.objectPosition !== '50% 50%') lost.push('`object-position` (planes center)')
  if (
    own &&
    new Set([style.borderTopLeftRadius, style.borderTopRightRadius, style.borderBottomRightRadius, style.borderBottomLeftRadius])
      .size > 1
  )
    lost.push('per-corner radii (planes use the top-left one)')
  const where = own ? '' : ` on its ancestor ${describe(n)}`
  for (const what of lost)
    warnOnce(
      `the plane ${describe(element)} has ${what}${where}, which the stage does not copy — the GPU draws it ` +
        'without. Remove the style, or drop usePlane on this element.',
    )
}

function fitOf(style: CSSStyleDeclaration): number {
  return style.objectFit === 'cover' ? 1 : style.objectFit === 'contain' ? 2 : 0
}

function elementSource(element: HTMLElement): TextureSource | null {
  if (element instanceof HTMLImageElement || element instanceof HTMLVideoElement || element instanceof HTMLCanvasElement)
    return element
  return null
}

function readyToUpload(source: TextureSource): boolean {
  if (source instanceof HTMLImageElement) return source.complete && source.naturalWidth > 0
  if (source instanceof HTMLVideoElement) return source.readyState >= 2
  return true
}

/** The bit of a `modulato:flip` event the stage reads (modulato ≥ 0.15). */
interface FlipDetail {
  clone: HTMLElement
  pair: { from: HTMLElement; to: HTMLElement; fromRect: DOMRect; toRect: DOMRect }
}

/**
 * How far a `<Shared>` flight has got, 0→1, read off where the clone IS —
 * so it follows the flight's easing, whatever it is. Measured on whichever of
 * width, height, x or y changes most between the two rects.
 */
function progress(rect: Rect, from: DOMRect, to: DOMRect): number {
  const axes: [number, number, number][] = [
    [rect.width, from.width, to.width],
    [rect.height, from.height, to.height],
    [rect.x, from.left, to.left],
    [rect.y, from.top, to.top],
  ]
  let best = axes[0]
  for (const axis of axes) if (Math.abs(axis[2] - axis[1]) > Math.abs(best[2] - best[1])) best = axis
  const span = best[2] - best[1]
  if (Math.abs(span) < 0.5) return 1
  return Math.min(1, Math.max(0, (best[0] - best[1]) / span))
}

/**
 * The stage: one canvas over the whole viewport that draws every plane on
 * the page, wherever its element is this frame. One per site, in the shell.
 */
export async function createStage(canvas: HTMLCanvasElement, options: StageOptions = {}): Promise<Stage | null> {
  if (active) {
    warnOnce('a second <GpuStage> mounted — only the first draws planes.')
    return null
  }
  const gpu = await createGpu(canvas, options)
  if (!gpu) return null

  const attached = new Map<PlaneRecord, Attached>()
  /** `<Shared>` clones in flight, by clone, with the plane they carry. */
  const flights = new Map<HTMLElement, { source: Attached; detail: FlipDetail }>()

  let pointerX = -1e6
  let pointerY = -1e6
  const onPointer = (e: PointerEvent) => {
    pointerX = e.clientX
    pointerY = e.clientY
  }
  window.addEventListener('pointermove', onPointer, { passive: true })

  // A shared element that is a live plane flies as one: the clone flipShared
  // makes is a copy of a hidden element, so it is hidden too, and the stage
  // draws it instead — with the source's shader, crossfading to the
  // destination's image, mipmapped so it stays sharp at every size between.
  const onFlip = (event: Event) => {
    const detail = (event as CustomEvent<FlipDetail>).detail
    const source = [...attached.values()].find((a) => a.record.element === detail?.pair.from)
    if (source?.live && source.pass) {
      flights.set(detail.clone, { source, detail })
      wake()
    }
  }
  window.addEventListener('modulato:flip', onFlip)
  // ...and one the stage did NOT take — an older modulato that sends no
  // event, or a plane that never went live — must not fly invisibly.
  const clones = new MutationObserver((records) => {
    for (const record of records)
      for (const node of record.addedNodes)
        if (node instanceof HTMLElement && node.hasAttribute('data-modulato-clone') && !flights.has(node))
          if (node.style.filter === 'opacity(0)') node.style.filter = ''
  })
  clones.observe(document.body, { childList: true })

  let clock = 0
  let last = 0
  let lastSignature = ''

  function hide(a: Attached, on: boolean) {
    if (on === a.live) return
    a.live = on
    const style = a.record.element.style
    if (on) {
      a.previousFilter = style.filter
      // `filter`, not `opacity` or `visibility`: those are what animation code
      // drives, and the stage READS them to fade the plane. A GSAP fade on
      // the element keeps working — it just reaches the screen through here.
      style.filter = 'opacity(0)'
    } else {
      style.filter = a.previousFilter ?? ''
    }
    a.record.setLive(on)
  }

  async function attach(record: PlaneRecord) {
    if (attached.has(record)) return
    const a: Attached = {
      record,
      pass: null,
      texture: null,
      textureReady: false,
      previousFilter: null,
      live: false,
      failed: false,
      cleanup: [],
    }
    attached.set(record, a)
    wake()
    if (DEV) {
      const filter = getComputedStyle(record.element).filter
      if (filter !== 'none' && filter !== 'opacity(0)')
        warnOnce(
          `the plane ${describe(record.element)} has a CSS \`filter\`, which the stage does not copy — the GPU ` +
            'draws it without. Remove the style, or drop usePlane on this element.',
        )
    }
    const opts = record.options.current
    const wanted = opts.texture === undefined ? 'element' : opts.texture
    let source: TextureSource | null
    if (wanted === 'element') source = elementSource(record.element)
    else if (typeof wanted === 'string') {
      try {
        source = await loadImage(wanted)
      } catch (e) {
        a.failed = true
        warnOnce((e as Error).message)
        return
      }
      if (!attached.has(record)) return
    } else source = wanted
    if (!source && !opts.fragment) {
      // The default shader draws an image; with none, the plane would be an
      // empty hole where the element was.
      a.failed = true
      warnOnce(
        `usePlane on a <${record.element.localName}> needs a fragment shader or a texture — ` +
          'only <img>, <video> and <canvas> bring their own image.',
      )
      return
    }
    try {
      a.pass = await gpu!.pass({ fragment: opts.fragment ?? DEFAULT_FRAGMENT, blend: 'alpha' })
    } catch (e) {
      a.failed = true
      console.error(e)
      return
    }
    if (!attached.has(record)) return a.pass.dispose()
    if (!source) {
      a.textureReady = true
      return
    }
    const upload = () => {
      if (!attached.has(record) || !readyToUpload(source)) return
      try {
        if (a.texture) a.texture.update(source)
        else a.texture = gpu!.texture(source, { mipmaps: opts.mipmaps ?? true })
        a.pass!.texture('image', a.texture)
        a.textureReady = true
      } catch (e) {
        // A cross-origin image without CORS headers cannot be read by the
        // GPU. The element goes back on screen as itself.
        a.failed = true
        hide(a, false)
        warnOnce(`a plane's image could not be uploaded (${(e as Error).message}) — it stays a DOM element.`)
      }
    }
    upload()
    // A new `src`, or `srcset` picking a different candidate, loads again.
    if (source instanceof HTMLImageElement || source instanceof HTMLVideoElement) {
      const event = source instanceof HTMLImageElement ? 'load' : 'loadeddata'
      source.addEventListener(event, upload)
      a.cleanup.push(() => source.removeEventListener(event, upload))
    }
  }

  function detach(record: PlaneRecord) {
    const a = attached.get(record)
    if (!a) return
    attached.delete(record)
    hide(a, false)
    for (const fn of a.cleanup) fn()
    a.pass?.dispose()
    a.texture?.dispose()
  }

  interface Item {
    a: Attached
    element: HTMLElement
    rect: Rect
    look: Look
    page: HTMLElement | null
    rank: number
    /** What `imageTo` samples — the plane's own texture except mid-flight. */
    imageTo: Texture | null
    values: Record<string, unknown>
  }

  function render() {
    // Nothing left to draw: clear once and stop asking for frames. The next
    // plane to attach (or a flight) starts them again.
    if (!attached.size && !flights.size) {
      if (lastSignature) gpu!.clear()
      lastSignature = ''
      stopFrames?.()
      stopFrames = null
      return
    }
    const now = performance.now()
    const delta = last ? (now - last) * (DEV ? getMotionSpeed() : 1) : 0
    last = now
    clock += delta

    const viewport: Rect = { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight }
    const scale = gpu!.width / (canvas.clientWidth || 1)

    function measure(a: Attached, element: HTMLElement, extra: Record<string, unknown>, imageTo: Texture | null) {
      const rect = toRect(element.getBoundingClientRect())
      if (rect.width <= 0 || rect.height <= 0) return null
      const l = look(element, viewport, element === a.record.element)
      if (l.opacity <= 0.001 || !l.clip || !intersect(rect, l.clip)) return null
      const opts = a.record.options.current
      const style = getComputedStyle(element)
      const pointer: [number, number] = [(pointerX - rect.x) / rect.width, 1 - (pointerY - rect.y) / rect.height]
      const user =
        typeof opts.uniforms === 'function'
          ? opts.uniforms({ time: clock / 1000, delta: delta / 1000, rect, pointer })
          : (opts.uniforms ?? {})
      const page = pageOf(element)
      const size = a.texture ? [a.texture.width, a.texture.height] : [1, 1]
      const to = imageTo ?? a.texture
      const item: Item = {
        a,
        element,
        rect,
        look: l,
        page,
        rank: rankOf(page),
        imageTo: to,
        values: {
          planeSize: [rect.width * scale, rect.height * scale],
          imageSize: size,
          imageToSize: to ? [to.width, to.height] : size,
          planeRadius: (parseFloat(style.borderTopLeftRadius) || 0) * scale,
          planeFit: fitOf(style),
          planePointer: pointer,
          planeMorph: 0,
          ...extra,
          ...user,
        },
      }
      return item
    }

    const items: Item[] = []
    for (const a of attached.values()) {
      if (!a.pass || !a.textureReady || a.failed) continue
      // Hidden or off screen, the element stays hidden — it is on the GPU's
      // side of the line until it detaches.
      hide(a, true)
      const opts = a.record.options.current
      const source = opts.texture === undefined || opts.texture === 'element' ? elementSource(a.record.element) : null
      if (a.texture && source && (opts.live || (source instanceof HTMLVideoElement && !source.paused)))
        a.texture.update(source)
      const item = measure(a, a.record.element, {}, null)
      if (item) items.push(item)
    }
    for (const [clone, { source, detail }] of flights) {
      if (!clone.isConnected) {
        flights.delete(clone)
        continue
      }
      const destination = [...attached.values()].find((a) => a.record.element === detail.pair.to)
      const landing = destination?.texture && destination.textureReady ? destination.texture : null
      const rect = toRect(clone.getBoundingClientRect())
      const item = measure(
        source,
        clone,
        { planeMorph: landing ? progress(rect, detail.pair.fromRect, detail.pair.toRect) : 0 },
        landing,
      )
      if (item) items.push(item)
    }

    // Lower pages first, then document order within a page.
    items.sort((p, q) =>
      p.rank !== q.rank
        ? p.rank - q.rank
        : p.element.compareDocumentPosition(q.element) & Node.DOCUMENT_POSITION_FOLLOWING
          ? -1
          : 1,
    )

    // During a transition the outgoing page is stacked over the incoming
    // one. The DOM hides the incoming page's images under it; the canvas,
    // above both, has to cut them out by hand. Each page above a plane's own
    // covers it with its root element's box, at that element's opacity.
    const covers = new Map<HTMLElement, { rect: Rect; opacity: number; rank: number }>()
    if (items.some((i) => i.page)) {
      for (const page of mountedPages()) {
        const root = (page.firstElementChild as HTMLElement | null) ?? page
        covers.set(page, {
          rect: toRect(root.getBoundingClientRect()),
          opacity: look(root, viewport).opacity,
          rank: rankOf(page),
        })
      }
    }

    const draws: { item: Item; clip: Rect; factor: number }[] = []
    for (const item of items) {
      let pieces = [{ rect: intersect(item.rect, item.look.clip!)!, factor: 1 }]
      for (const [page, cover] of covers) {
        if (page === item.page || cover.rank <= item.rank || cover.opacity <= 0.001) continue
        const next: typeof pieces = []
        for (const piece of pieces) {
          for (const outside of subtract(piece.rect, cover.rect)) next.push({ rect: outside, factor: piece.factor })
          const under = intersect(piece.rect, cover.rect)
          if (under && cover.opacity < 0.999) next.push({ rect: under, factor: piece.factor * (1 - cover.opacity) })
        }
        pieces = next
      }
      for (const piece of pieces) draws.push({ item, clip: piece.rect, factor: piece.factor })
    }

    // Nothing moved and nothing changed: the last frame stands.
    const signature = JSON.stringify([
      gpu!.width,
      gpu!.height,
      draws.map((d) => [d.item.rect, d.clip, d.factor * d.item.look.opacity, d.item.values]),
    ])
    if (signature === lastSignature && !gpu!.dirty) return
    lastSignature = signature

    gpu!.clear()
    for (const { item, clip, factor } of draws) {
      const pass = item.a.pass!
      if (item.imageTo) pass.texture('imageTo', item.imageTo)
      pass.set(item.values).set('planeOpacity', item.look.opacity * factor).draw({ rect: item.rect, clip })
    }
  }

  // Frames only while there is something to draw — a page without planes
  // costs the stage nothing per frame.
  let stopFrames: (() => void) | null = null
  function wake() {
    stopFrames ??= onLateFrame(render)
  }

  const stage: Stage = {
    gpu,
    attach: (record) => void attach(record),
    detach,
    dispose() {
      stopFrames?.()
      clones.disconnect()
      window.removeEventListener('pointermove', onPointer)
      window.removeEventListener('modulato:flip', onFlip)
      for (const record of [...attached.keys()]) detach(record)
      gpu.dispose()
      if (active === stage) active = null
    },
  }
  active = stage
  for (const record of records) stage.attach(record)
  return stage
}
