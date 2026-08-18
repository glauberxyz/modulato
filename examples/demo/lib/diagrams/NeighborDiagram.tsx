import { useRef, useState } from 'react'
import { HalftoneImage } from '../HalftoneCanvas'
import { DEFAULTS, type HalftoneUniforms } from '../halftone'
import { Choice, Diagram, Slider } from '../Control'
import './diagrams.scss'

const WINDOWS = [
  { value: 0, label: '1×1' },
  { value: 1, label: '3×3' },
  { value: 2, label: '5×5' },
]

/**
 * Why the shader loops over nine cells instead of one. Set the window to
 * 1×1 and push coverage: the dots hit their cell walls and square off, and
 * the image can never reach solid black.
 */
export function NeighborDiagram() {
  const [win, setWin] = useState(1)
  const [flood, setFlood] = useState(0.18)
  const uniforms = useRef<HalftoneUniforms>({
    ...DEFAULTS,
    size: 0.62,
    softness: 0,
    contrast: 1.1,
    window: 1,
    floodK: 0.18,
    plates: [0, 0, 0, 1],
  })

  const fetches = (win * 2 + 1) ** 2 * 4

  return (
    <Diagram
      n="Fig. E"
      title="Kill the neighbor loop"
      controls={
        <>
          <Choice
            label="Window"
            value={win}
            options={WINDOWS}
            onChange={(v) => {
              setWin(v)
              uniforms.current.window = v
            }}
          />
          <Slider
            label="Coverage"
            value={flood}
            min={0}
            max={0.6}
            onChange={(v) => {
              setFlood(v)
              uniforms.current.floodK = v
            }}
          />
          <div className="nb__stat">
            <span className="label">Texture fetches / pixel</span>
            <strong>{fetches}</strong>
          </div>
        </>
      }
      caption={
        win === 0
          ? 'At 1×1 each pixel only asks its own cell. Dots that grow past the cell wall are chopped off square — and the darkest the image can get is a grid of touching squares, never solid ink.'
          : 'Asking the neighbors costs more fetches, but a dot is allowed to overlap the cells around it — which is what ink actually does on paper.'
      }
    >
      <HalftoneImage
        src="/plates/ramp-shadows.jpg"
        alt="A tonal ramp screened with the current neighbor window"
        uniforms={uniforms}
      />
    </Diagram>
  )
}
