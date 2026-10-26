import type { Backend, FragmentInput, Shader, ShaderLang, ShaderSource, UniformValue } from './types'

export function isShader(value: unknown): value is Shader {
  return (
    !!value &&
    typeof value === 'object' &&
    typeof (value as Shader).code === 'string' &&
    ((value as Shader).lang === 'wgsl' || (value as Shader).lang === 'glsl')
  )
}

/** WGSL marks its entry points with attributes; GLSL never has an `@`. */
export function detectLang(code: string): ShaderLang {
  return /@(fragment|vertex|compute|group|binding)\b/.test(code) ? 'wgsl' : 'glsl'
}

/** A string becomes a Shader that never changes — no hot reload for it. */
export function toShader(source: ShaderSource): Shader {
  if (isShader(source)) return source
  return { lang: detectLang(source), code: source, version: 0 }
}

/**
 * The shader this backend runs, or a sentence saying why there is none —
 * thrown as-is, so it has to teach the fix.
 */
export function pickFragment(input: FragmentInput, backend: Backend): Shader {
  const want: ShaderLang = backend === 'webgpu' ? 'wgsl' : 'glsl'
  const sources =
    typeof input === 'string' || isShader(input)
      ? [toShader(input)]
      : [input.wgsl, input.glsl].filter((s): s is ShaderSource => !!s).map(toShader)
  const match = sources.find((s) => s.lang === want)
  if (match) return match
  const have = sources.map((s) => s.lang.toUpperCase()).join(' and ') || 'no shader'
  const name = sources[0]?.id ? ` (${sources[0].id})` : ''
  throw new Error(
    backend === 'webgpu'
      ? `[modulato/gpu] this pass has ${have}${name} but the surface is WebGPU, which runs WGSL. ` +
          `Create it with createGpu(canvas, { backend: 'webgl2' }) to keep GLSL, ` +
          `or give the pass both: { fragment: { wgsl, glsl } }.`
      : `[modulato/gpu] this pass has ${have}${name} but the surface is WebGL2, which runs GLSL — ` +
          `the browser has no WebGPU, or the surface asked for 'webgl2'. ` +
          `Give the pass a GLSL fallback: { fragment: { wgsl, glsl } }.`,
  )
}

/**
 * The names a uniform or texture might go by: `size`, `u_size` — GLSL's
 * habit — and `size_`, because WGSL reserves a long list of ordinary words
 * (`type`, `target`, `filter`, `smooth`, `set`…) and a trailing underscore is
 * how a port keeps the name the page already sets.
 */
export function aliases(name: string): string[] {
  const bare = name.startsWith('u_') ? name.slice(2) : name
  return [name, bare === name ? `u_${bare}` : bare, `${bare}_`]
}

/** `#rgb`, `#rrggbb` or `#rrggbbaa` → [r, g, b, a] in 0–1; null if not a color. */
export function parseColor(value: string): [number, number, number, number] | null {
  const hex = value.trim().replace(/^#/, '')
  if (!/^([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(hex)) return null
  const full = hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex
  const byte = (i: number) => parseInt(full.slice(i, i + 2), 16) / 255
  return [byte(0), byte(2), byte(4), full.length === 8 ? byte(6) : 1]
}

/**
 * Flatten a uniform value into `size` numbers, or null when the value cannot
 * fill that slot. A color string fills 3 or 4; a scalar fills only 1.
 */
export function toNumbers(value: UniformValue, size: number): number[] | null {
  if (typeof value === 'number') return size === 1 ? [value] : null
  if (typeof value === 'boolean') return size === 1 ? [value ? 1 : 0] : null
  if (typeof value === 'string') {
    const rgba = parseColor(value)
    if (!rgba || (size !== 3 && size !== 4)) return null
    return rgba.slice(0, size)
  }
  if (Array.isArray(value) && value.length === size) return value.map(Number)
  return null
}
