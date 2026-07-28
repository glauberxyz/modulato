import { useRef, useState } from 'react'
import { HalftoneImage } from '../HalftoneCanvas'
import { DEFAULTS, type HalftoneUniforms } from '../halftone'
import { Choice, Diagram, Slider } from '../Control'

/**
 * The three dot shapes the shader can print, and what softness actually
 * does — it widens the threshold band on an already-smooth field, it does
 * not blur anything.
 */
export function InkDiagram() {
  const [type, setType] = useState(0)
  const [softness, setSoftness] = useState(0.1)
  const [size, setSize] = useState(0.5)
  const uniforms = useRef<HalftoneUniforms>({
    ...DEFAULTS,
    size: 0.5,
    softness: 0.1,
    type: 0,
  })

  return (
    <Diagram
      n="Fig. D"
      title="Dots, ink, sharp"
      controls={
        <>
          <Choice
            label="Mode"
            value={type}
            options={[
              { value: 0, label: 'Dots' },
              { value: 1, label: 'Ink' },
              { value: 2, label: 'Sharp' },
            ]}
            onChange={(v) => {
              setType(v)
              uniforms.current.type = v
            }}
          />
          <Slider
            label="Ruling"
            value={size}
            min={0.1}
            max={0.9}
            onChange={(v) => {
              setSize(v)
              uniforms.current.size = v
            }}
            format={(v) => `${Math.round(400 - v ** 0.7 * 393)} cells`}
          />
          <Slider
            label="Softness"
            value={softness}
            min={0}
            max={1}
            onChange={(v) => {
              setSoftness(v)
              uniforms.current.softness = v
            }}
          />
        </>
      }
      caption={
        type === 0
          ? 'Separate dots: each cell’s mask is thresholded on its own, so dots stay discrete even where they overlap.'
          : type === 1
            ? 'Ink: the four masks are summed before thresholding, so neighbouring dots merge the way wet ink does.'
            : 'Sharp: colour is sampled per pixel rather than per cell — closer to a modern imagesetter than to a glass screen.'
      }
    >
      <HalftoneImage
        src="/plates/shantytown-1880.jpg"
        alt="The 1880 Shantytown halftone, re-screened"
        uniforms={uniforms}
      />
    </Diagram>
  )
}
