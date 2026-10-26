export type Backend = 'webgpu' | 'webgl2'

export type ShaderLang = 'wgsl' | 'glsl'

/**
 * A shader as `@modulato/vite` hands it over from a `.wgsl`, `.glsl`, `.frag`
 * or `.vert` import.
 *
 * It is an OBJECT, not a string, for the sake of hot reload: in dev every
 * edit re-evaluates the file into the same object, bumping `version`, so a
 * pass holding it notices on its next draw and recompiles in place — no
 * remount, no lost state, and nothing for a component to list as an effect
 * dependency.
 */
export interface Shader {
  lang: ShaderLang
  code: string
  version: number
  /** The file it came from, in dev. For error messages and the dev registry. */
  id?: string
}

/** A shader file, a `Shader`, or a plain source string (language detected). */
export type ShaderSource = Shader | string

/**
 * What a pass draws. One language, or both — with both, the surface's
 * backend picks: WGSL on WebGPU, GLSL on WebGL2. That pair is the whole
 * fallback story; nothing is translated.
 */
export type FragmentInput = ShaderSource | { wgsl?: ShaderSource; glsl?: ShaderSource }

/**
 * A uniform's value. Numbers and booleans fill scalars; arrays fill vectors;
 * a `#rgb` / `#rrggbb` / `#rrggbbaa` string fills a vec3 or vec4 with the
 * color in 0–1. That last one is what lets a color token from `motion.ts`
 * go straight into a shader.
 */
export type UniformValue = number | boolean | string | readonly number[]

/** Pixel data for a texture: RGBA, 8 bits per channel, row 0 first. */
export interface TextureData {
  width: number
  height: number
  data: Uint8Array
}

export type TextureSource =
  | HTMLImageElement
  | HTMLCanvasElement
  | HTMLVideoElement
  | ImageBitmap
  | OffscreenCanvas
  | TextureData

export interface TextureOptions {
  /** Default `'linear'`. */
  filter?: 'linear' | 'nearest'
  /** Default `'clamp'`. */
  wrap?: 'clamp' | 'repeat' | 'mirror'
  /**
   * Build the mip chain on every upload, and sample it. What keeps an image
   * sharp rather than shimmering when a plane draws it smaller than it is —
   * a thumbnail, or the far end of a layout transition. Default `false`.
   */
  mipmaps?: boolean
  /**
   * Flip an image source on upload so that `uv.y = 0` is its BOTTOM row — the
   * GL convention, which both backends follow. Default `true`. Ignored for
   * raw `TextureData`, whose row 0 is always `uv.y = 0`.
   */
  flipY?: boolean
}

export interface Texture {
  readonly width: number
  readonly height: number
  /** Re-upload. Same size reuses the texture; a new size reallocates it. */
  update(source: TextureSource): void
  dispose(): void
}

export interface TargetOptions {
  /** Size relative to the canvas's backing store. Default `1`. */
  scale?: number
  /** Default `'linear'`. */
  filter?: 'linear' | 'nearest'
}

/**
 * An offscreen texture a pass draws into, sized from the canvas and resized
 * with it. Bind it to a later pass like any texture. Its contents do not
 * survive a resize — redraw it.
 */
export interface Target extends Texture {
  readonly scale: number
}

/** A rectangle in CSS pixels, from the canvas's top-left corner. */
export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface DrawOptions {
  /**
   * Draw into this rectangle instead of the whole target. `uv` still runs
   * 0→1 across it. A drawn rect paints over what is there; the rest of the
   * target is untouched.
   */
  rect?: Rect
  /** Nothing outside this rectangle is touched (a scissor). */
  clip?: Rect
}

export interface PassOptions {
  fragment: FragmentInput
  /**
   * A GLSL vertex shader, for a migration whose fragment shader expects
   * something other than `in vec2 v_uv`. It must take `a_position` (a
   * fullscreen triangle, clip space). WebGL2 only — a WGSL pass always uses
   * the framework's own vertex stage.
   */
  vertex?: ShaderSource
  /** Draw into this instead of the canvas. */
  target?: Target
  /**
   * `'none'` (default) writes the shader's output as-is. `'alpha'` composites
   * it over what is there, source-over — and expects PREMULTIPLIED output
   * (`vec4(rgb * a, a)`), which is what keeps edges free of dark fringes.
   */
  blend?: 'none' | 'alpha'
}

export interface Pass {
  /** Set one uniform. A `u_` prefix is optional on either side. */
  set(name: string, value: UniformValue): Pass
  /**
   * Set several at once — a token group from `motion.ts` works as-is.
   * Nested objects are skipped.
   */
  set(values: Readonly<Record<string, unknown>>): Pass
  /** Bind a texture or target to a sampler. A `u_` prefix is optional. */
  texture(name: string, texture: Texture): Pass
  /**
   * Draw into the target, or the canvas. With no `rect` and no blending it
   * replaces the whole target; with either, it paints over what is there.
   * One pass can be drawn many times a frame — each draw uses the uniforms
   * set just before it.
   */
  draw(options?: DrawOptions): void
  /** The current compile or validation error, or `null`. */
  readonly error: string | null
  dispose(): void
}

export interface GpuOptions {
  /**
   * `'auto'` (the default) takes WebGPU where the browser has it and falls
   * back to WebGL2. A site whose shaders are all GLSL says `'webgl2'`.
   *
   * In dev, `?gpu=webgl2` or `?gpu=webgpu` in the page URL overrides this for
   * every surface — the quickest way to look at the fallback.
   */
  backend?: Backend | 'auto'
  /** Cap on the device pixel ratio. Default `2`. */
  dpr?: number
  /** A transparent canvas. Default `true`. */
  alpha?: boolean
}

export interface Gpu {
  readonly backend: Backend
  readonly canvas: HTMLCanvasElement
  /** Backing-store size in pixels. */
  readonly width: number
  readonly height: number
  /**
   * True when the last frame no longer stands: the canvas resized, a shader
   * hot-swapped, a texture re-uploaded. Cleared by the next `draw()` of a
   * pass onto the canvas. A surface that only draws when its inputs change checks this too —
   * `if (key === lastKey && !gpu.dirty) return`.
   */
  readonly dirty: boolean
  pass(options: PassOptions): Promise<Pass>
  texture(source: TextureSource, options?: TextureOptions): Texture
  target(options?: TargetOptions): Target
  /** Clear the canvas to transparent — the start of a frame of rect draws. */
  clear(): void
  /** Match the backing store to the canvas's CSS size. Runs on every draw. */
  resize(): boolean
  /** Everything this surface created. The canvas itself is left alone. */
  dispose(): void
}
