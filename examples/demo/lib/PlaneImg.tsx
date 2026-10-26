import { type ImgHTMLAttributes, useRef } from 'react'
import { usePlane } from '@modulato/gpu'

/**
 * An `<img>` the GPU stage draws. Server-rendered and laid out exactly like
 * the plain element — same alt, same CSS, same `<Shared>` id — and drawn by
 * the stage once it has the picture; until then, or with no GPU, it is just
 * the image. What it buys today is the plate flight: a `<Shared>` morph
 * between two of these is drawn mipmapped, so the picture stays sharp at
 * every size it passes through.
 */
export function PlaneImg(props: ImgHTMLAttributes<HTMLImageElement>) {
  const ref = useRef<HTMLImageElement>(null)
  usePlane(ref)
  return <img ref={ref} {...props} />
}
