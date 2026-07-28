import { useRef, useState } from 'react'
import { HalftoneImage } from '../HalftoneCanvas'
import { DEFAULTS, type HalftoneUniforms } from '../halftone'
import { Diagram, Slider } from '../Control'

/**
 * 1904 and now, side by side. The manual's own plates show the Flatiron
 * Building through six Levy screens; the slider runs our shader across the
 * same range. Same argument, 120 years apart.
 */
export function RulingDiagram() {
  const [size, setSize] = useState(0.3)
  const uniforms = useRef<HalftoneUniforms>({ ...DEFAULTS, size: 0.3, contrast: 1.3 })
  const cells = Math.round(400 - size ** 0.7 * 393)

  return (
    <Diagram
      n="Fig. E"
      title="How coarse is coarse"
      controls={
        <>
          <Slider
            label="Ruling"
            value={size}
            min={0.05}
            max={0.95}
            onChange={(v) => {
              setSize(v)
              uniforms.current.size = v
            }}
            format={() => `${cells} cells`}
          />
          <div className="ruling__plates">
            <figure>
              <img src="/plates/ruling-coarse.jpg" alt="60, 75 and 85 line screens" />
              <figcaption className="figref">1904 · 60 / 75 / 85 lines</figcaption>
            </figure>
            <figure>
              <img src="/plates/ruling-fine.jpg" alt="175, 200 and 400 line screens" />
              <figcaption className="figref">1904 · 175 / 200 / 400 lines</figcaption>
            </figure>
          </div>
        </>
      }
      caption="Coarse screens survive newsprint, where absorbent paper spreads every dot. Fine screens need coated stock — and past about 300 lines the structure leaves human vision entirely, which was always the objective."
    >
      <HalftoneImage
        src="/plates/ruling-fine.jpg"
        alt="A halftone at the selected ruling"
        uniforms={uniforms}
      />
    </Diagram>
  )
}
