import { useRef, useState } from 'react'
import { useTicker } from 'modulato'
import { useGpu } from '@modulato/gpu'
import {
  createHalftone,
  DEFAULTS,
  pressBackend,
  type HalftoneUniforms,
  type SceneUniforms,
} from './halftone'

// No shader in any effect's dependencies, and no remount on a shader edit:
// the .wgsl and .frag imports hot-swap inside the pass, and the surface marks
// itself dirty when they do, so even a still press redraws on save.

/**
 * The live raymarched scene, screened through the halftone. Uniforms are
 * read from a ref every frame, so a parent can drive them from a slider
 * without re-rendering React.
 */
export function HalftoneScene({
  uniforms,
  scene,
  className,
}: {
  uniforms: React.RefObject<HalftoneUniforms>
  scene: React.RefObject<SceneUniforms>
  className?: string
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const press = useGpu(canvasRef, (gpu) => createHalftone(gpu, { source: 'scene' }), [], {
    backend: pressBackend('scene'),
  })

  useTicker((time) => {
    if (uniforms.current && scene.current) press.current?.render(time, uniforms.current, scene.current)
  })

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />
}

/**
 * Everything a still press draws from. Two components share it so neither can
 * quietly stop redrawing when a uniform is added — the whole point of the key
 * is that it is exhaustive, and a second hand-maintained copy would not stay
 * that way.
 */
const uniformKey = (u: HalftoneUniforms) =>
  `${u.size}|${u.contrast}|${u.softness}|${u.gridNoise}|${u.grainOverlay}|${u.type}|${u.window}|${u.angles}|${u.plates}|${u.floodK}|${u.gains}|${u.inks}|${u.paper}|${u.flat}|${u.noBlack}|${u.tone}|${u.cover}`

/**
 * Draw only when something moved: a uniform, or the surface itself (a
 * resize, a re-upload, a hot-swapped shader — `dirty` covers all three). A
 * still image with unchanged uniforms produces an identical frame, so
 * redrawing it 60 times a second is pure heat; this way the diagrams stay
 * live while you drag a slider and go completely idle the rest of the time.
 */
function useStillPress(
  press: React.RefObject<Awaited<ReturnType<typeof createHalftone>> | null>,
  uniforms: React.RefObject<HalftoneUniforms>,
) {
  const lastKey = useRef('')
  useTicker((time) => {
    const u = uniforms.current
    const p = press.current
    if (!u || !p) return
    const key = uniformKey(u)
    if (key === lastKey.current && !p.dirty) return
    lastKey.current = key
    p.render(time, u)
  })
}

/**
 * A flat field of color, screened.
 *
 * The same press, pointed at one color instead of a picture — so what you
 * see is what a press would actually lay down to make that color: dots, at
 * the size the coverage demands. Which is the honest answer, on a site whose
 * first claim is that a printed gray is not gray.
 */
export function HalftoneFlat({
  uniforms,
  label,
  className,
}: {
  uniforms: React.RefObject<HalftoneUniforms>
  label: string
  className?: string
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const press = useGpu(canvasRef, (gpu) => createHalftone(gpu, { source: 'color' }))
  useStillPress(press, uniforms)
  return <canvas ref={canvasRef} className={className} role="img" aria-label={label} />
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

/**
 * A still image, screened. Used by every diagram — the same press that runs
 * the homepage, pointed at a 19th-century scan.
 */
export function HalftoneImage({
  src,
  alt,
  uniforms,
  className,
}: {
  src: string
  alt: string
  uniforms: React.RefObject<HalftoneUniforms>
  className?: string
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [ready, setReady] = useState(false)
  const press = useGpu(
    canvasRef,
    async (gpu) => {
      const image = await loadImage(src)
      const created = await createHalftone(gpu, { source: 'image', image })
      setReady(true)
      return created
    },
    [src],
  )
  useStillPress(press, uniforms)

  return (
    <canvas
      ref={canvasRef}
      className={className}
      role="img"
      aria-label={alt}
      data-ready={ready ? '' : undefined}
    />
  )
}

export { DEFAULTS }
