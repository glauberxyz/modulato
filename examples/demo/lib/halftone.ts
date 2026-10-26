import type { Gpu, Pass, Target, Texture } from '@modulato/gpu'
import halftoneWgsl from './halftone.wgsl'
import halftoneGlsl from './halftone.frag'
import sceneGlsl from './scene.frag'

export interface HalftoneUniforms {
  size: number
  contrast: number
  softness: number
  gridNoise: number
  grainOverlay: number
  /** 0 = separate dots, 1 = ink (dots join), 2 = sharp. */
  type: number
  /** Screen angles in degrees: C, M, Y, K. Standard is 15 / 75 / 0 / 45. */
  angles: [number, number, number, number]
  /** Neighbor search radius: 0 = 1x1, 1 = 3x3 (correct), 2 = 5x5. */
  window: number
  /** Per-plate mute, 0 or 1. */
  plates: [number, number, number, number]
  floodK: number
  gains: [number, number, number, number]
  inks: [string, string, string, string]
  paper: string
  /** The field to screen, for a `color` press — an even wash of one color
   *  instead of a photograph. Ignored by the other two sources. */
  flat?: string
  /** Separate with no black plate: each color ink carries its whole channel.
   *  Not the same as muting K — see `u_noBlack` in the shader. */
  noBlack?: boolean
  /** Split-tone applied BEFORE the separation: `[shadow, highlight, amount]`.
   *  A monochrome source separates onto the black plate alone, so this is what
   *  gives the color screens anything to carry. See `u_warm` in the shader
   *  for why it takes two colors rather than one. */
  tone?: [string, string, number]
  /** Fill the frame and crop, keeping the source's proportions. Default is the
   *  original behavior: stretch the source over the frame. */
  cover?: boolean
}

export const DEFAULTS: HalftoneUniforms = {
  size: 0.42,
  contrast: 1.2,
  softness: 0.1,
  gridNoise: 0,
  grainOverlay: 0.12,
  type: 0,
  angles: [15, 75, 0, 45],
  window: 1,
  plates: [1, 1, 1, 1],
  floodK: 0,
  gains: [-0.17, -0.45, -0.45, 0],
  inks: ['#00a0c6', '#d81e78', '#f5c400', '#231f20'],
  paper: '#f4f1ea',
}

export interface SceneUniforms {
  speed: number
  radius: number
  height: number
  count: number
  camHeight: number
  camDist: number
  band: number
  cap: number
}

const rgba = (hex: string): [number, number, number, number] => [
  parseInt(hex.slice(1, 3), 16) / 255,
  parseInt(hex.slice(3, 5), 16) / 255,
  parseInt(hex.slice(5, 7), 16) / 255,
  1,
]

/** Which surface a press needs: the scene shader exists only in GLSL. */
export const pressBackend = (source: 'scene' | 'image' | 'color') =>
  source === 'scene' ? ('webgl2' as const) : ('auto' as const)

/**
 * A halftone press on a GPU surface.
 *
 * Source is either the live raymarched scene (rendered into a target first)
 * or a still image, or one flat color. Either way the second pass screens it
 * through the CMYK halftone — in WGSL on WebGPU, in GLSL on WebGL2; the
 * surface decides. Nothing here owns a RAF — call `render()` from the
 * framework ticker so the whole site shares one loop (and so Tweak's slow-mo
 * reaches it, since useTicker runs on the motion clock).
 */
export async function createHalftone(
  gpu: Gpu,
  opts: { source: 'scene' | 'image' | 'color'; image?: HTMLImageElement } = { source: 'scene' },
) {
  const halftone = await gpu.pass({ fragment: { wgsl: halftoneWgsl, glsl: halftoneGlsl } })

  // Static noise for the grid jitter (Paper's randomRG).
  const noise = new Uint8Array(256 * 256 * 4)
  let seed = 1
  for (let i = 0; i < noise.length; i++) {
    seed = (seed * 16807) % 2147483647
    noise[i] = seed % 256
  }
  halftone.texture(
    'noiseTexture',
    gpu.texture({ width: 256, height: 256, data: noise }, { wrap: 'repeat' }),
  )

  let source: Texture | Target
  let scene: Pass | null = null
  let imageAspect = 1

  if (opts.source === 'scene') {
    const target = gpu.target()
    source = target
    scene = await gpu.pass({ fragment: sceneGlsl, target })
  } else if (opts.source === 'image' && opts.image) {
    source = gpu.texture(opts.image)
    imageAspect = opts.image.naturalWidth / opts.image.naturalHeight
  } else {
    // A flat field is a ONE-PIXEL texture, stretched. Every sample returns the
    // same color, so there is nothing an image of any other size could add —
    // and it means changing the color is a four-byte upload rather than
    // rebuilding the press, which is what lets a slider drive it per frame.
    source = gpu.texture(
      { width: 1, height: 1, data: new Uint8Array([255, 255, 255, 255]) },
      { filter: 'nearest' },
    )
  }
  halftone.texture('image', source)
  let lastFlat = ''

  return {
    /** The last frame no longer stands — resized, re-uploaded, hot-swapped. */
    get dirty() {
      return gpu.dirty
    },
    render(timeMs: number, h: HalftoneUniforms, sceneUniforms?: SceneUniforms) {
      gpu.resize()
      // Same for a flat field and the scene, and for the same reason: there
      // is no picture whose shape could set this, so the CANVAS is the shape.
      // Take the 1x1 texture's own aspect of 1 instead and the cell grid comes
      // out stretched — round dots become ovals on any stage that is not
      // square.
      if (opts.source !== 'image') imageAspect = gpu.width / gpu.height

      // Four bytes, and only when the color actually moved.
      if (opts.source === 'color' && h.flat && h.flat !== lastFlat) {
        lastFlat = h.flat
        const [r, g, b] = rgba(h.flat)
        source.update({
          width: 1,
          height: 1,
          data: new Uint8Array([Math.round(r * 255), Math.round(g * 255), Math.round(b * 255), 255]),
        })
      }

      if (scene && sceneUniforms) {
        scene
          .set({
            resolution: [gpu.width, gpu.height],
            time: (timeMs / 1000) * sceneUniforms.speed,
            ring: [sceneUniforms.radius, sceneUniforms.height, sceneUniforms.count],
            cam: [sceneUniforms.camHeight, sceneUniforms.camDist],
            band: sceneUniforms.band,
            cap: sceneUniforms.cap,
          })
          .draw()
      }

      // Covering means the CELLS are laid out against the frame, not the
      // source — which is what keeps a dot round when the two shapes differ.
      // The source's own aspect goes in separately, for the crop window.
      const frameAspect = gpu.width / gpu.height
      const [sr, sg, sb] = rgba(h.tone?.[0] ?? '#000000')
      halftone
        .set({
          imageAspectRatio: h.cover ? frameAspect : imageAspect,
          sourceAspect: imageAspect,
          cover: h.cover ? 1 : 0,
          warm: [sr, sg, sb, h.tone?.[2] ?? 0],
          cool: h.tone?.[1] ?? '#ffffff',
          colorBack: h.paper,
          colorC: h.inks[0],
          colorM: h.inks[1],
          colorY: h.inks[2],
          colorK: h.inks[3],
          size: h.size,
          contrast: h.contrast,
          softness: h.softness,
          gridNoise: h.gridNoise,
          grainOverlay: h.grainOverlay,
          type: h.type,
          angles: h.angles,
          window: h.window,
          plates: h.plates,
          noBlack: h.noBlack ? 1 : 0,
          floodC: 0,
          floodM: 0,
          floodY: 0,
          floodK: h.floodK,
          gainC: h.gains[0],
          gainM: h.gains[1],
          gainY: h.gains[2],
          gainK: h.gains[3],
        })
        .draw()
    },
  }
}

export type Press = Awaited<ReturnType<typeof createHalftone>>

/** Beat wavelength between two screens, in cells — the moiré readout. */
export function beatCells(a: number, b: number): number {
  let d = Math.abs(a - b) % 90
  if (d > 45) d = 90 - d
  if (d < 0.01) return Infinity
  return 1 / (2 * Math.sin((d * Math.PI) / 180 / 2))
}
