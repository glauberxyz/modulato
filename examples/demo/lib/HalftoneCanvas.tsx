import { useEffect, useRef, useState } from 'react'
import { useTicker } from 'modulato'
import { createHalftone, DEFAULTS, type HalftoneUniforms, type SceneUniforms } from './halftone'

type Press = ReturnType<typeof createHalftone>

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
  const press = useRef<Press>(null)

  useEffect(() => {
    if (!canvasRef.current) return undefined
    press.current = createHalftone(canvasRef.current, { source: 'scene' })
    return () => {
      press.current?.dispose()
      press.current = null
    }
  }, [])

  useTicker((time) => {
    if (uniforms.current && scene.current) press.current?.render(time, uniforms.current, scene.current)
  })

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />
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
  const press = useRef<Press>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let alive = true
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = src
    img.onload = () => {
      if (!alive || !canvasRef.current) return
      press.current = createHalftone(canvasRef.current, { source: 'image', image: img })
      setReady(true)
    }
    return () => {
      alive = false
      press.current?.dispose()
      press.current = null
    }
  }, [src])

  useTicker((time) => {
    if (uniforms.current) press.current?.render(time, uniforms.current)
  })

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
