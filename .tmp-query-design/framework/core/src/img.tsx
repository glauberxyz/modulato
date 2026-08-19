import { useEffect, useRef, type ImgHTMLAttributes } from 'react'

export interface ImgProps extends ImgHTMLAttributes<HTMLImageElement> {
  src: string
  alt: string
  /** Reserve layout: `ratio` (e.g. "3/2") or width+height. */
  ratio?: string
  /** Skip lazy-loading (above-the-fold hero images). */
  eager?: boolean
}

/**
 * The framework image: lazy by default, async-decoded, layout reserved via
 * aspect-ratio (no CLS), gentle fade-in when the image loads. Progressive:
 * without JS it's a plain <img> that is never hidden.
 */
export function Img({ src, alt, ratio, eager, style, ...rest }: ImgProps) {
  const ref = useRef<HTMLImageElement>(null)

  useEffect(() => {
    const img = ref.current
    // Already decoded (cache hit before hydration) — nothing to fade.
    if (!img || img.complete) return undefined
    img.style.opacity = '0'
    const reveal = () => {
      img.style.transition = 'opacity 0.6s ease'
      img.style.opacity = '1'
    }
    img.addEventListener('load', reveal, { once: true })
    img.addEventListener('error', reveal, { once: true })
    return () => {
      img.removeEventListener('load', reveal)
      img.removeEventListener('error', reveal)
      img.style.opacity = ''
      img.style.transition = ''
    }
  }, [src])

  const aspectRatio =
    ratio ?? (rest.width && rest.height ? `${rest.width} / ${rest.height}` : undefined)

  return (
    <img
      ref={ref}
      src={src}
      alt={alt}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      style={aspectRatio ? { aspectRatio, ...style } : style}
      {...rest}
    />
  )
}
