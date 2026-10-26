// Build-time GPU assets: `?sdf` and `?points` imports.
//
// The idea is to do the geometry once, at build, rather than on every visit:
// an SVG's signed distance field, or an outline sampled into points, is a
// pure function of the file and the query, so the browser should receive the
// answer — not the question and a library to work it out.
//
// No dependencies. SVG is read by a small tokenizer that understands the
// subset icons and logos are made of (shapes, paths, groups, transforms);
// fonts go through opentype.js, loaded from the PROJECT only when a font is
// actually imported, so a site that never does pays nothing.
import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import zlib from 'node:zlib'

const FONT_EXTENSIONS = new Set(['.ttf', '.otf', '.woff'])

/** `{ kind, params }` for an id this module handles, else null. */
export function assetQuery(id) {
  const q = id.indexOf('?')
  if (q < 0) return null
  const params = new URLSearchParams(id.slice(q + 1))
  const file = id.slice(0, q)
  const ext = path.extname(file).toLowerCase()
  if (params.has('sdf') && ext === '.svg') return { kind: 'sdf', file, params }
  if (params.has('points') && (ext === '.svg' || FONT_EXTENSIONS.has(ext))) return { kind: 'points', file, params }
  if ((params.has('sdf') || params.has('points')) && ext !== '.svg' && !FONT_EXTENSIONS.has(ext))
    throw new Error(
      `[modulato] ${path.basename(file)}?${params.has('sdf') ? 'sdf' : 'points'}: ` +
        `\`?sdf\` takes an .svg, \`?points\` an .svg or a font (.ttf, .otf, .woff).`,
    )
  return null
}

const num = (params, key, fallback) => {
  const v = params.get(key)
  if (v === null || v === '') return fallback
  const n = Number(v)
  if (!Number.isFinite(n) || n <= 0) throw new Error(`[modulato] \`${key}=${v}\` must be a positive number.`)
  return n
}

// ── geometry: affine transforms ─────────────────────────────────────────

const IDENTITY = [1, 0, 0, 1, 0, 0]

function multiply(m, n) {
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ]
}

function parseTransform(value) {
  let m = IDENTITY
  if (!value) return m
  for (const [, name, args] of value.matchAll(/(\w+)\s*\(([^)]*)\)/g)) {
    const a = args.split(/[\s,]+/).filter(Boolean).map(Number)
    let t = IDENTITY
    if (name === 'matrix') t = a
    else if (name === 'translate') t = [1, 0, 0, 1, a[0] ?? 0, a[1] ?? 0]
    else if (name === 'scale') t = [a[0], 0, 0, a[1] ?? a[0], 0, 0]
    else if (name === 'rotate') {
      const r = ((a[0] ?? 0) * Math.PI) / 180
      t = [Math.cos(r), Math.sin(r), -Math.sin(r), Math.cos(r), 0, 0]
      if (a.length >= 3) t = multiply(multiply([1, 0, 0, 1, a[1], a[2]], t), [1, 0, 0, 1, -a[1], -a[2]])
    } else if (name === 'skewX') t = [1, 0, Math.tan(((a[0] ?? 0) * Math.PI) / 180), 1, 0, 0]
    else if (name === 'skewY') t = [1, Math.tan(((a[0] ?? 0) * Math.PI) / 180), 0, 1, 0, 0]
    m = multiply(m, t)
  }
  return m
}

// ── geometry: paths to polylines ────────────────────────────────────────

/**
 * Path data → contours, each a flat [x, y, x, y, …] array with `closed`.
 * Curves are flattened to segments no longer than `step` (source units).
 */
function flattenPath(d, step) {
  const contours = []
  let current = null
  let x = 0
  let y = 0
  let startX = 0
  let startY = 0
  let lastControl = null
  let lastCommand = ''
  const tokens = d.match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g) ?? []
  let i = 0
  const nextNumber = () => Number(tokens[i++])
  // Arc flags are single digits, and minified paths pack them against what
  // follows — `a1 1 0 01 10 10` is flags 0 and 1, then 10. Take one character.
  const nextFlag = () => {
    const t = tokens[i]
    if (t.length > 1 && (t[0] === '0' || t[0] === '1')) {
      tokens[i] = t.slice(1)
      return t[0] === '1'
    }
    i++
    return Number(t) !== 0
  }
  const isNumber = () => i < tokens.length && !/[a-zA-Z]/.test(tokens[i])
  const lineTo = (nx, ny) => {
    current.points.push(nx, ny)
    x = nx
    y = ny
  }
  const curve = (pts, at) => {
    // Enough pieces that none is longer than `step`, judged by the control
    // polygon (an upper bound on the curve's length).
    let length = 0
    for (let k = 2; k < pts.length; k += 2) length += Math.hypot(pts[k] - pts[k - 2], pts[k + 1] - pts[k - 1])
    const pieces = Math.min(256, Math.max(2, Math.ceil(length / step)))
    for (let s = 1; s <= pieces; s++) {
      const [px, py] = at(s / pieces)
      current.points.push(px, py)
    }
    x = pts[pts.length - 2]
    y = pts[pts.length - 1]
  }
  let command = ''
  while (i < tokens.length) {
    if (!isNumber()) command = tokens[i++]
    const rel = command === command.toLowerCase()
    const C = command.toUpperCase()
    const ox = rel ? x : 0
    const oy = rel ? y : 0
    if (C === 'M') {
      current = { points: [], closed: false }
      contours.push(current)
      const nx = nextNumber() + ox
      const ny = nextNumber() + oy
      current.points.push(nx, ny)
      x = startX = nx
      y = startY = ny
      // Further pairs after a moveto are implicit linetos.
      command = rel ? 'l' : 'L'
      lastControl = null
      lastCommand = 'M'
      continue
    }
    if (!current) {
      current = { points: [x, y], closed: false }
      contours.push(current)
    }
    if (C === 'Z') {
      current.closed = true
      x = startX
      y = startY
      current = null
      lastControl = null
      lastCommand = 'Z'
      continue
    }
    if (C === 'L') lineTo(nextNumber() + ox, nextNumber() + oy)
    else if (C === 'H') lineTo(nextNumber() + ox, y)
    else if (C === 'V') lineTo(x, nextNumber() + oy)
    else if (C === 'C' || C === 'S') {
      let c1x
      let c1y
      if (C === 'C') {
        c1x = nextNumber() + ox
        c1y = nextNumber() + oy
      } else if (lastControl && (lastCommand === 'C' || lastCommand === 'S')) {
        c1x = 2 * x - lastControl[0]
        c1y = 2 * y - lastControl[1]
      } else {
        c1x = x
        c1y = y
      }
      const c2x = nextNumber() + ox
      const c2y = nextNumber() + oy
      const ex = nextNumber() + ox
      const ey = nextNumber() + oy
      const sx = x
      const sy = y
      curve([sx, sy, c1x, c1y, c2x, c2y, ex, ey], (t) => {
        const u = 1 - t
        return [
          u * u * u * sx + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * ex,
          u * u * u * sy + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * ey,
        ]
      })
      lastControl = [c2x, c2y]
      lastCommand = C
      continue
    } else if (C === 'Q' || C === 'T') {
      let cx
      let cy
      if (C === 'Q') {
        cx = nextNumber() + ox
        cy = nextNumber() + oy
      } else if (lastControl && (lastCommand === 'Q' || lastCommand === 'T')) {
        cx = 2 * x - lastControl[0]
        cy = 2 * y - lastControl[1]
      } else {
        cx = x
        cy = y
      }
      const ex = nextNumber() + ox
      const ey = nextNumber() + oy
      const sx = x
      const sy = y
      curve([sx, sy, cx, cy, ex, ey], (t) => {
        const u = 1 - t
        return [u * u * sx + 2 * u * t * cx + t * t * ex, u * u * sy + 2 * u * t * cy + t * t * ey]
      })
      lastControl = [cx, cy]
      lastCommand = C
      continue
    } else if (C === 'A') {
      const rx0 = Math.abs(nextNumber())
      const ry0 = Math.abs(nextNumber())
      const rotation = (nextNumber() * Math.PI) / 180
      const large = nextFlag()
      const sweep = nextFlag()
      const ex = nextNumber() + ox
      const ey = nextNumber() + oy
      arc(x, y, rx0, ry0, rotation, large, sweep, ex, ey, step, (px, py) => current.points.push(px, py))
      x = ex
      y = ey
    } else {
      throw new Error(`[modulato] unknown path command \`${command}\``)
    }
    lastControl = null
    lastCommand = C
  }
  return contours
}

/** SVG elliptical arc, endpoint form (SVG 1.1 F.6.5), as points. */
function arc(x1, y1, rx, ry, phi, large, sweep, x2, y2, step, emit) {
  if (rx === 0 || ry === 0) return emit(x2, y2)
  const cos = Math.cos(phi)
  const sin = Math.sin(phi)
  const dx = (x1 - x2) / 2
  const dy = (y1 - y2) / 2
  const x1p = cos * dx + sin * dy
  const y1p = -sin * dx + cos * dy
  const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry)
  if (lambda > 1) {
    rx *= Math.sqrt(lambda)
    ry *= Math.sqrt(lambda)
  }
  const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p
  const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p
  const coef = (large !== sweep ? 1 : -1) * Math.sqrt(Math.max(0, num / den))
  const cxp = (coef * rx * y1p) / ry
  const cyp = (-coef * ry * x1p) / rx
  const cx = cos * cxp - sin * cyp + (x1 + x2) / 2
  const cy = sin * cxp + cos * cyp + (y1 + y2) / 2
  const angle = (ux, uy, vx, vy) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy)
  const theta = angle(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry)
  let delta = angle((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry)
  if (!sweep && delta > 0) delta -= 2 * Math.PI
  if (sweep && delta < 0) delta += 2 * Math.PI
  const pieces = Math.min(256, Math.max(2, Math.ceil((Math.abs(delta) * Math.max(rx, ry)) / step)))
  for (let s = 1; s <= pieces; s++) {
    const t = theta + (delta * s) / pieces
    emit(cx + rx * Math.cos(t) * cos - ry * Math.sin(t) * sin, cy + rx * Math.cos(t) * sin + ry * Math.sin(t) * cos)
  }
}

/** A basic shape's attributes as path data. */
function shapeToPath(tag, a) {
  const n = (k, d = 0) => (a[k] === undefined ? d : parseFloat(a[k]))
  switch (tag) {
    case 'path':
      return a.d ?? ''
    case 'rect': {
      const x = n('x')
      const y = n('y')
      const w = n('width')
      const h = n('height')
      let rx = a.rx === undefined ? undefined : n('rx')
      let ry = a.ry === undefined ? undefined : n('ry')
      rx ??= ry ?? 0
      ry ??= rx
      rx = Math.min(rx, w / 2)
      ry = Math.min(ry, h / 2)
      if (!rx || !ry) return `M${x},${y}H${x + w}V${y + h}H${x}Z`
      return (
        `M${x + rx},${y}H${x + w - rx}A${rx},${ry} 0 0 1 ${x + w},${y + ry}V${y + h - ry}` +
        `A${rx},${ry} 0 0 1 ${x + w - rx},${y + h}H${x + rx}A${rx},${ry} 0 0 1 ${x},${y + h - ry}` +
        `V${y + ry}A${rx},${ry} 0 0 1 ${x + rx},${y}Z`
      )
    }
    case 'circle':
    case 'ellipse': {
      const cx = n('cx')
      const cy = n('cy')
      const rx = tag === 'circle' ? n('r') : n('rx')
      const ry = tag === 'circle' ? n('r') : n('ry')
      return `M${cx - rx},${cy}A${rx},${ry} 0 1 0 ${cx + rx},${cy}A${rx},${ry} 0 1 0 ${cx - rx},${cy}Z`
    }
    case 'line':
      return `M${n('x1')},${n('y1')}L${n('x2')},${n('y2')}`
    case 'polyline':
    case 'polygon': {
      const pts = (a.points ?? '').trim().split(/[\s,]+/).map(Number)
      if (pts.length < 4) return ''
      let d = `M${pts[0]},${pts[1]}`
      for (let k = 2; k + 1 < pts.length; k += 2) d += `L${pts[k]},${pts[k + 1]}`
      return tag === 'polygon' ? `${d}Z` : d
    }
    default:
      return ''
  }
}

function attributes(source) {
  const out = {}
  for (const m of source.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) out[m[1]] = m[2] ?? m[3]
  // `style="fill:none; …"` speaks for the attributes it names.
  if (out.style)
    for (const decl of out.style.split(';')) {
      const [k, v] = decl.split(':').map((s) => s?.trim())
      if (k && v) out[k] = v
    }
  return out
}

/**
 * An SVG file → its filled outlines, in user units, plus the viewBox.
 * Throws — with the fix — on what this reader does not draw.
 */
function readSvg(source, file, step) {
  const svg = source
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, '')
    .replace(/<\?[\s\S]*?\?>/g, '')
    .replace(/<!DOCTYPE[\s\S]*?>/gi, '')
  const contours = []
  const skipped = new Set()
  const stack = [{ m: IDENTITY, hidden: false, fill: 'black', rule: 'nonzero' }]
  let shape = 0
  let viewBox = null
  for (const [, closing, tag, attrs, selfClosing] of svg.matchAll(/<(\/?)([a-zA-Z][\w:-]*)([^>]*?)(\/?)>/g)) {
    if (closing) {
      if (stack.length > 1 && (tag === 'g' || tag === 'svg' || tag === 'a' || tag === 'defs' || tag === 'clipPath' || tag === 'mask' || tag === 'symbol'))
        stack.pop()
      continue
    }
    const a = attributes(attrs)
    const parent = stack[stack.length - 1]
    const hidden =
      parent.hidden || a.display === 'none' || a.visibility === 'hidden' || ['defs', 'clipPath', 'mask', 'symbol'].includes(tag)
    const fill = a.fill ?? parent.fill
    const rule = a['fill-rule'] ?? parent.rule
    const m = multiply(parent.m, parseTransform(a.transform))
    if (tag === 'svg' && !viewBox) {
      const vb = (a.viewBox ?? '').split(/[\s,]+/).map(Number)
      viewBox =
        vb.length === 4 && vb.every(Number.isFinite)
          ? vb
          : [0, 0, parseFloat(a.width) || 0, parseFloat(a.height) || 0]
    }
    if (['svg', 'g', 'a', 'defs', 'clipPath', 'mask', 'symbol'].includes(tag)) {
      if (!selfClosing) stack.push({ m, hidden, fill, rule })
      continue
    }
    if (hidden) continue
    if (['use', 'text', 'image', 'tspan'].includes(tag)) {
      skipped.add(`<${tag}>`)
      continue
    }
    const d = shapeToPath(tag, a)
    if (!d) continue
    if (fill === 'none') {
      skipped.add('unfilled shapes (fill="none")')
      continue
    }
    shape++
    for (const contour of flattenPath(d, step)) {
      // Fill rules belong to a shape: its contours wind together, and a
      // point is inside the drawing if it is inside ANY shape.
      contour.shape = shape
      contour.evenOdd = rule === 'evenodd'
      const p = contour.points
      for (let k = 0; k < p.length; k += 2) {
        const x = p[k]
        const y = p[k + 1]
        p[k] = m[0] * x + m[2] * y + m[4]
        p[k + 1] = m[1] * x + m[3] * y + m[5]
      }
      contours.push(contour)
    }
  }
  if (!viewBox || !viewBox[2] || !viewBox[3])
    throw new Error(`[modulato] ${file}: no viewBox (or width and height) on the <svg> — nothing to size the result by.`)
  if (!contours.length)
    throw new Error(
      `[modulato] ${file}: no filled shapes found` +
        (skipped.size ? ` (skipped ${[...skipped].join(', ')})` : '') +
        '. Strokes have no area — outline them in your editor ("Outline stroke") first.',
    )
  return { contours, viewBox, skipped: [...skipped] }
}

// ── signed distance field ───────────────────────────────────────────────

/**
 * A signed distance field of the filled shapes: one byte per pixel, 128 at
 * the edge, rising inside and falling outside, `spread` pixels from the edge
 * to 255/0. `size` is the longer side of the shape itself; `spread` pixels of
 * margin go round it so the field has room to fall off.
 */
function sdf(contours, viewBox, size, spread, forceEvenOdd) {
  const [vx, vy, vw, vh] = viewBox
  const scale = size / Math.max(vw, vh) // output px per source unit
  const width = Math.max(1, Math.round(vw * scale)) + spread * 2
  const height = Math.max(1, Math.round(vh * scale)) + spread * 2
  // Segments in OUTPUT pixels, so distance comes out in pixels.
  const segs = []
  let shapes = 0
  const evenOdd = []
  for (const c of contours) {
    const p = c.points
    const n = p.length / 2
    const id = c.shape ?? 0
    shapes = Math.max(shapes, id + 1)
    evenOdd[id] = forceEvenOdd || !!c.evenOdd
    const count = c.closed || n > 2 ? n : n - 1 // filled: every contour closes implicitly
    for (let k = 0; k < count; k++) {
      const j = (k + 1) % n
      segs.push([
        (p[k * 2] - vx) * scale + spread,
        (p[k * 2 + 1] - vy) * scale + spread,
        (p[j * 2] - vx) * scale + spread,
        (p[j * 2 + 1] - vy) * scale + spread,
        id,
      ])
    }
  }
  // Bucket segments into cells one spread wide: the nearest segment within
  // `spread` of a pixel is then always in its own cell or a neighbour.
  const cell = Math.max(1, spread)
  const cols = Math.ceil(width / cell) + 1
  const rows = Math.ceil(height / cell) + 1
  const grid = Array.from({ length: cols * rows }, () => [])
  for (const s of segs) {
    const x0 = Math.max(0, Math.floor(Math.min(s[0], s[2]) / cell))
    const x1 = Math.min(cols - 1, Math.floor(Math.max(s[0], s[2]) / cell))
    const y0 = Math.max(0, Math.floor(Math.min(s[1], s[3]) / cell))
    const y1 = Math.min(rows - 1, Math.floor(Math.max(s[1], s[3]) / cell))
    for (let gy = y0; gy <= y1; gy++) for (let gx = x0; gx <= x1; gx++) grid[gy * cols + gx].push(s)
  }
  const out = new Uint8Array(width * height)
  for (let py = 0; py < height; py++) {
    const y = py + 0.5
    // Inside/outside along this row, from where it crosses the outline.
    const crossings = []
    for (const [ax, ay, bx, by, id] of segs) {
      if (ay <= y === by <= y) continue
      crossings.push([ax + ((y - ay) / (by - ay)) * (bx - ax), by > ay ? 1 : -1, id])
    }
    crossings.sort((p, q) => p[0] - q[0])
    let c = 0
    const winding = new Int32Array(shapes)
    const crossed = new Int32Array(shapes)
    let insideCount = 0
    const isIn = (id) => (evenOdd[id] ? crossed[id] % 2 === 1 : winding[id] !== 0)
    for (let px = 0; px < width; px++) {
      const x = px + 0.5
      while (c < crossings.length && crossings[c][0] < x) {
        const [, dir, id] = crossings[c++]
        const was = isIn(id)
        winding[id] += dir
        crossed[id]++
        const now = isIn(id)
        if (now !== was) insideCount += now ? 1 : -1
      }
      const inside = insideCount > 0
      let best = spread * spread
      const gx = Math.floor(x / cell)
      const gy = Math.floor(y / cell)
      for (let oy = -1; oy <= 1; oy++)
        for (let ox = -1; ox <= 1; ox++) {
          const cx = gx + ox
          const cy = gy + oy
          if (cx < 0 || cy < 0 || cx >= cols || cy >= rows) continue
          for (const [ax, ay, bx, by] of grid[cy * cols + cx]) {
            const dx = bx - ax
            const dy = by - ay
            const len = dx * dx + dy * dy
            const t = len ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len)) : 0
            const ex = ax + t * dx - x
            const ey = ay + t * dy - y
            const d2 = ex * ex + ey * ey
            if (d2 < best) best = d2
          }
        }
      const d = Math.sqrt(best) * (inside ? 1 : -1)
      out[py * width + px] = Math.max(0, Math.min(255, Math.round(127.5 + (d / spread) * 127.5)))
    }
  }
  return { width, height, data: out, scale }
}

// ── PNG (grayscale, 8-bit) ──────────────────────────────────────────────

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(bytes) {
  let c = 0xffffffff
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length)
  out.writeUInt32BE(data.length, 0)
  out.write(type, 4, 'ascii')
  Buffer.from(data).copy(out, 8)
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length)
  return out
}

function png(width, height, gray) {
  const raw = Buffer.alloc((width + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (width + 1)] = 0 // filter: none
    Buffer.from(gray.buffer, gray.byteOffset + y * width, width).copy(raw, y * (width + 1) + 1)
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header[8] = 8 // bit depth
  header[9] = 0 // grayscale
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// ── points ──────────────────────────────────────────────────────────────

/**
 * Walk each contour and drop a point every `pitch` units of arc length. A
 * closed contour divides its length evenly instead — the pitch rounded to
 * fit — or the last point crowds the first where the outline closes.
 */
function sample(contours, pitch) {
  const out = []
  for (const c of contours) {
    const p = c.points
    const n = p.length / 2
    if (n < 2) continue
    const closed = c.closed || n > 2
    const count = closed ? n : n - 1
    let total = 0
    for (let k = 0; k < count; k++) {
      const j = (k + 1) % n
      total += Math.hypot(p[j * 2] - p[k * 2], p[j * 2 + 1] - p[k * 2 + 1])
    }
    if (!total) continue
    const step = closed ? total / Math.max(1, Math.round(total / pitch)) : pitch
    const wanted = closed ? Math.round(total / step) : Math.floor(total / step) + 1
    let carry = 0
    let placed = 0
    for (let k = 0; k < count && placed < wanted; k++) {
      const j = (k + 1) % n
      const ax = p[k * 2]
      const ay = p[k * 2 + 1]
      const dx = p[j * 2] - ax
      const dy = p[j * 2 + 1] - ay
      const len = Math.hypot(dx, dy)
      let t = carry
      while (t <= len && placed < wanted) {
        out.push(ax + (dx * t) / (len || 1), ay + (dy * t) / (len || 1))
        placed++
        t += step
      }
      carry = t - len
    }
  }
  return out
}

async function fontContours(file, params, root) {
  const text = params.get('text')
  if (!text) throw new Error(`[modulato] ${path.basename(file)}?points needs the text to lay out: \`?text=Hello&points\`.`)
  let opentype
  try {
    const require = createRequire(path.join(root, 'package.json'))
    opentype = await import(require.resolve('opentype.js'))
  } catch {
    throw new Error(
      `[modulato] ${path.basename(file)}?points reads fonts with opentype.js, which this project does not have. ` +
        '`npm i -D opentype.js` — it runs at build time only and never ships.',
    )
  }
  const parse = opentype.parse ?? opentype.default?.parse
  const buffer = fs.readFileSync(file)
  const font = parse(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength))
  const fontSize = num(params, 'size', 100)
  const pathData = font.getPath(text, 0, 0, fontSize, { kerning: true }).toPathData(3)
  const contours = flattenPath(pathData, num(params, 'pitch', 4) / 4)
  return { contours, unitsPerPx: 1 }
}

// ── the module ──────────────────────────────────────────────────────────

/**
 * Write a generated file where Vite will treat it as an ordinary asset, and
 * return the import that names it. Vite then does what it does for any image
 * — serves it in dev, hashes and copies it in a build, and gives the client
 * and SSR bundles the same URL. node_modules/, because the output is a cache:
 * never committed, rebuilt from the source file on demand.
 */
function emitter(root) {
  const dir = path.join(root, 'node_modules', '.modulato', 'gpu')
  return (name, source) => {
    fs.mkdirSync(dir, { recursive: true })
    const hash = crc32(source).toString(16).padStart(8, '0')
    const file = path.join(dir, name.replace(/(\.[^.]+)$/, `-${hash}$1`))
    if (!fs.existsSync(file)) fs.writeFileSync(file, source)
    return file
  }
}

/** Compile an asset import into a module. */
export async function assetModule(query, root) {
  const emit = emitter(root)
  const { kind, file, params } = query
  const name = path.basename(file)
  if (kind === 'sdf') {
    const size = num(params, 'size', 128)
    const spread = Math.round(num(params, 'spread', Math.max(2, Math.round(size / 16))))
    const { contours, viewBox, skipped } = readSvg(fs.readFileSync(file, 'utf8'), name, Math.max(viewBox0(file), 1) / size / 2)
    const field = sdf(contours, viewBox, size, spread, params.get('rule') === 'evenodd')
    const image = emit(`${name.replace(/\.svg$/i, '')}.sdf.png`, png(field.width, field.height, field.data))
    return [
      `import url from ${JSON.stringify(image)}`,
      `export default {`,
      `  kind: 'sdf',`,
      `  url,`,
      `  width: ${field.width},`,
      `  height: ${field.height},`,
      `  spread: ${spread},`,
      `  viewBox: ${JSON.stringify(viewBox)},`,
      `  skipped: ${JSON.stringify(skipped)},`,
      `}`,
    ].join('\n')
  }
  // points
  const pitch = num(params, 'pitch', 4)
  let contours
  let bounds
  if (path.extname(file).toLowerCase() === '.svg') {
    const size = params.has('size') ? num(params, 'size', 0) : null
    const read = readSvg(fs.readFileSync(file, 'utf8'), name, 0.25)
    const [vx, vy, vw, vh] = read.viewBox
    const scale = size ? size / Math.max(vw, vh) : 1
    for (const c of read.contours)
      for (let k = 0; k < c.points.length; k += 2) {
        c.points[k] = (c.points[k] - vx) * scale
        c.points[k + 1] = (c.points[k + 1] - vy) * scale
      }
    contours = read.contours
    bounds = [0, 0, vw * scale, vh * scale]
  } else {
    contours = (await fontContours(file, params, root)).contours
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const c of contours)
      for (let k = 0; k < c.points.length; k += 2) {
        minX = Math.min(minX, c.points[k])
        maxX = Math.max(maxX, c.points[k])
        minY = Math.min(minY, c.points[k + 1])
        maxY = Math.max(maxY, c.points[k + 1])
      }
    // Text sits on a baseline at y = 0; shift it so the box starts at 0, 0.
    for (const c of contours)
      for (let k = 0; k < c.points.length; k += 2) {
        c.points[k] -= minX
        c.points[k + 1] -= minY
      }
    bounds = [0, 0, maxX - minX, maxY - minY]
  }
  const points = sample(contours, pitch).map((v) => Math.round(v * 100) / 100)
  return [
    `export default {`,
    `  kind: 'points',`,
    `  points: new Float32Array(${JSON.stringify(points)}),`,
    `  count: ${points.length / 2},`,
    `  width: ${Math.round(bounds[2] * 100) / 100},`,
    `  height: ${Math.round(bounds[3] * 100) / 100},`,
    `}`,
  ].join('\n')
}

// The flattening step for an SDF is set in source units, which needs the
// viewBox before the full read — a cheap peek at the root element.
function viewBox0(file) {
  const head = fs.readFileSync(file, 'utf8').slice(0, 4096)
  const vb = /viewBox\s*=\s*["']([^"']+)["']/.exec(head)?.[1]?.split(/[\s,]+/).map(Number)
  if (vb && vb.length === 4) return Math.max(vb[2], vb[3])
  const w = parseFloat(/\bwidth\s*=\s*["']([\d.]+)/.exec(head)?.[1] ?? '0')
  const h = parseFloat(/\bheight\s*=\s*["']([\d.]+)/.exec(head)?.[1] ?? '0')
  return Math.max(w, h)
}
