import type {
  Rect,
  Pass,
  PassOptions,
  Target,
  TargetOptions,
  Texture,
  TextureData,
  TextureOptions,
  TextureSource,
  UniformValue,
} from './types'

/** True in dev builds (Vite). False in prod and in non-Vite consumers. */
export const DEV: boolean =
  typeof import.meta !== 'undefined' &&
  Boolean((import.meta as { env?: { DEV?: boolean } }).env?.DEV)

/**
 * Uniforms the stage hands every plane. A shader that has no use for one
 * simply does not declare it — so these never warn as unknown.
 */
export const PLANE_UNIFORMS = new Set([
  'planeSize',
  'imageSize',
  'imageToSize',
  'planeOpacity',
  'planeRadius',
  'planeFit',
  'planePointer',
  'planeMorph',
  // Textures, likewise: a plane's shader may sample one, both or neither.
  'image',
  'imageTo',
])

const warned = new Set<string>()

/** console.warn once per unique message, dev only. */
export function warnOnce(message: string): void {
  if (!DEV || warned.has(message)) return
  warned.add(message)
  console.warn(`[modulato/gpu] ${message}`)
}

export function isData(source: TextureSource): source is TextureData {
  return 'data' in source && source.data instanceof Uint8Array
}

export function sourceSize(source: TextureSource): { width: number; height: number } {
  if (isData(source)) return { width: source.width, height: source.height }
  if (typeof HTMLImageElement !== 'undefined' && source instanceof HTMLImageElement)
    return { width: source.naturalWidth, height: source.naturalHeight }
  if (typeof HTMLVideoElement !== 'undefined' && source instanceof HTMLVideoElement)
    return { width: source.videoWidth, height: source.videoHeight }
  const sized = source as { width: number; height: number }
  return { width: sized.width, height: sized.height }
}

/**
 * What a backend shares with the surface around it: the backing-store size,
 * and the flag that says the last frame no longer stands.
 */
export interface Surface {
  width: number
  height: number
  /** The canvas's CSS size — what draw rects are measured in. */
  cssWidth: number
  cssHeight: number
  dirty: boolean
  /** Match the backing store to the canvas's CSS size; true if it changed. */
  resize(): boolean
  /** Called at the end of every canvas draw — still inside the task that drew. */
  drawn(): void
}

/** What each backend builds; `createGpu` wraps it into the public `Gpu`. */
export interface BackendImpl {
  pass(options: PassOptions): Promise<Pass>
  texture(source: TextureSource, options?: TextureOptions): Texture
  target(options?: TargetOptions): Target
  /** Clear the canvas to transparent. */
  clear(): void
  /** The canvas changed size: reallocate every target. */
  resized(): void
  /** For the dev registry: what each live pass is running and was given. */
  describe(): PassInfo[]
  dispose(): void
}

export interface PassInfo {
  shader: string
  lang: string
  error: string | null
  uniforms: Record<string, UniformValue>
  textures: string[]
}

/**
 * The uniforms a pass has been given, by the name they were SET under.
 *
 * Kept on the pass rather than pushed straight into the backend, because a
 * hot-swapped shader starts from nothing: the new program is handed every
 * value again, so an edit to the shader never resets what the page set.
 */
export type UniformStore = Map<string, UniformValue>

export function collect(
  store: UniformStore,
  nameOrValues: string | Readonly<Record<string, unknown>>,
  value?: UniformValue,
): void {
  if (typeof nameOrValues === 'string') {
    if (value !== undefined) store.set(nameOrValues, value)
    return
  }
  for (const [key, v] of Object.entries(nameOrValues)) {
    if (
      typeof v === 'number' ||
      typeof v === 'boolean' ||
      typeof v === 'string' ||
      (Array.isArray(v) && v.every((n) => typeof n === 'number'))
    )
      store.set(key, v as UniformValue)
  }
}

/**
 * Where a draw lands, in clip space: [left, bottom, right, top]. The whole
 * target when there is no rect.
 */
export function areaOf(rect: Rect | undefined, surface: Surface): [number, number, number, number] {
  if (!rect) return [-1, -1, 1, 1]
  const w = surface.cssWidth || 1
  const h = surface.cssHeight || 1
  return [
    (rect.x / w) * 2 - 1,
    1 - ((rect.y + rect.height) / h) * 2,
    ((rect.x + rect.width) / w) * 2 - 1,
    1 - (rect.y / h) * 2,
  ]
}

/**
 * A clip rect in a target's own pixels, top-left origin, clamped to the
 * target. `null` when nothing of it is on the target — skip the draw.
 */
export function scissorOf(
  clip: Rect,
  surface: Surface,
  targetWidth: number,
  targetHeight: number,
): { x: number; y: number; width: number; height: number } | null {
  const sx = targetWidth / (surface.cssWidth || 1)
  const sy = targetHeight / (surface.cssHeight || 1)
  const x0 = Math.max(0, Math.floor(clip.x * sx))
  const y0 = Math.max(0, Math.floor(clip.y * sy))
  const x1 = Math.min(targetWidth, Math.ceil((clip.x + clip.width) * sx))
  const y1 = Math.min(targetHeight, Math.ceil((clip.y + clip.height) * sy))
  if (x1 <= x0 || y1 <= y0) return null
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 }
}
