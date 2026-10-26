/**
 * Just enough WGSL reflection to bind a fragment shader without the author
 * declaring anything twice: the uniform structs (laid out by WGSL's own
 * alignment rules, so `set('size', 0.4)` knows which bytes to write), the
 * textures and samplers, and the fragment entry point.
 *
 * Deliberately a reader of DECLARATIONS, not a parser of the language. It
 * sees `@group(0) @binding(n) var…` lines and `struct` bodies and nothing
 * else, and it throws — with the fix — on anything it does not lay out
 * rather than guessing at bytes.
 */

export interface UniformField {
  name: string
  /** Byte offset into the binding's buffer. */
  offset: number
  /** Components: 1 for a scalar, 2–4 for a vector. */
  size: number
  kind: 'f32' | 'i32' | 'u32'
}

export type Binding =
  | { kind: 'uniform'; binding: number; name: string; byteSize: number; fields: UniformField[] }
  | { kind: 'texture'; binding: number; name: string }
  | { kind: 'sampler'; binding: number; name: string }

export interface Reflection {
  entry: string
  bindings: Binding[]
}

function stripComments(code: string): string {
  // WGSL block comments nest, so a regex alone gets `/* a /* b */ c */` wrong.
  let out = ''
  let depth = 0
  for (let i = 0; i < code.length; i++) {
    const two = code.slice(i, i + 2)
    if (two === '/*') {
      depth++
      i++
    } else if (two === '*/' && depth) {
      depth--
      i++
    } else if (!depth && two === '//') {
      while (i < code.length && code[i] !== '\n') i++
      out += '\n'
    } else if (!depth) out += code[i]
  }
  return out
}

const VECTOR = /^vec([234])(?:<\s*(f32|i32|u32)\s*>|([fiu]))$/

function typeInfo(type: string): { size: number; align: number; kind: UniformField['kind'] } | null {
  const t = type.replace(/\s+/g, '')
  if (t === 'f32' || t === 'i32' || t === 'u32') return { size: 1, align: 4, kind: t }
  const v = VECTOR.exec(t)
  if (!v) return null
  const n = Number(v[1])
  const kind = (v[2] ?? { f: 'f32', i: 'i32', u: 'u32' }[v[3] as 'f' | 'i' | 'u']) as UniformField['kind']
  return { size: n, align: n === 2 ? 8 : 16, kind }
}

const roundUp = (n: number, to: number) => Math.ceil(n / to) * to

function layoutStruct(name: string, body: string, file: string): { fields: UniformField[]; byteSize: number } {
  const fields: UniformField[] = []
  let offset = 0
  let maxAlign = 4
  for (const raw of body.split(',')) {
    const member = raw.replace(/@\w+(\([^)]*\))?/g, '').trim()
    if (!member) continue
    const m = /^(\w+)\s*:\s*(.+)$/.exec(member)
    if (!m) continue
    const info = typeInfo(m[2])
    if (!info)
      throw new Error(
        `[modulato/gpu] ${file}: uniform field \`${name}.${m[1]}\` is a \`${m[2].trim()}\`. ` +
          `Uniform structs take f32/i32/u32 and their vec2/3/4 — pass a matrix as vec4 columns, ` +
          `an array as separate fields, a bool as an f32 of 0 or 1.`,
      )
    offset = roundUp(offset, info.align)
    fields.push({ name: m[1], offset, size: info.size, kind: info.kind })
    offset += info.size * 4
    maxAlign = Math.max(maxAlign, info.align)
  }
  // A uniform-space struct is 16-aligned however small its members are.
  return { fields, byteSize: roundUp(offset, Math.max(16, maxAlign)) }
}

export function reflect(source: string, file = 'shader'): Reflection {
  const code = stripComments(source)

  const entry = /@fragment\s+fn\s+(\w+)/.exec(code)?.[1]
  if (!entry)
    throw new Error(
      `[modulato/gpu] ${file}: no \`@fragment fn\`. A pass is a fragment shader — ` +
        `\`@fragment fn main(@location(0) uv: vec2f) -> @location(0) vec4f { … }\`.`,
    )

  const structs = new Map<string, string>()
  for (const m of code.matchAll(/struct\s+(\w+)\s*\{([^}]*)\}/g)) structs.set(m[1], m[2])

  const bindings: Binding[] = []
  const decl = /((?:@\w+\s*\(\s*\d+\s*\)\s*)+)var(?:\s*<\s*(\w+)[^>]*>)?\s+(\w+)\s*:\s*([^;=]+);/g
  for (const m of code.matchAll(decl)) {
    const attrs = m[1]
    const group = /@group\s*\(\s*(\d+)\s*\)/.exec(attrs)
    const slot = /@binding\s*\(\s*(\d+)\s*\)/.exec(attrs)
    if (!group || !slot) continue
    const name = m[3]
    const type = m[4].trim()
    if (group[1] !== '0')
      throw new Error(
        `[modulato/gpu] ${file}: \`${name}\` is in @group(${group[1]}). A pass binds group 0 only.`,
      )
    const binding = Number(slot[1])
    if (m[2] === 'uniform') {
      const body = structs.get(type)
      if (body) {
        bindings.push({ kind: 'uniform', binding, name, ...layoutStruct(type, body, file) })
      } else {
        const info = typeInfo(type)
        if (!info)
          throw new Error(`[modulato/gpu] ${file}: uniform \`${name}\` has a type this reader does not lay out: \`${type}\`.`)
        bindings.push({
          kind: 'uniform',
          binding,
          name,
          byteSize: 16,
          fields: [{ name, offset: 0, size: info.size, kind: info.kind }],
        })
      }
    } else if (/^texture_2d\s*<\s*f32\s*>$/.test(type)) {
      bindings.push({ kind: 'texture', binding, name })
    } else if (type === 'sampler') {
      bindings.push({ kind: 'sampler', binding, name })
    } else {
      throw new Error(
        `[modulato/gpu] ${file}: \`${name}: ${type}\` — a pass binds uniforms, texture_2d<f32> and sampler.`,
      )
    }
  }
  return { entry, bindings }
}
