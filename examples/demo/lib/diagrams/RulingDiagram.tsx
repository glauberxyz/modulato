import { useRef } from 'react'
import { HalftoneImage } from '../HalftoneCanvas'
import { DEFAULTS, type HalftoneUniforms } from '../halftone'
import { Diagram, Plate } from '../Control'

/**
 * One photograph, screened twice — coarse on the left, fine on the right.
 *
 * There is no slider, and that is the design. The argument is a COMPARISON,
 * and a comparison wants both terms on screen at once: a single stage on a
 * slider shows one ruling at a time and asks the reader to hold the other in
 * their head, which is exactly the work the picture is supposed to do for
 * them. It also let them drag to any value, most of which say nothing —
 * whereas these two are chosen, and are the two the prose names.
 *
 * The source is a continuous-tone-ish scan rather than one of the 1904 ruling
 * plates. Screening an already-screened plate puts our dots on top of Levy's
 * and the two lattices beat against each other, so the structure on screen
 * belonged to neither press — the previous version of this diagram was doing
 * exactly that, against the very plate it displayed beside itself.
 */

/** The shader's own mapping, inverted: `cellsPerSide = mix(400, 7, size^0.7)`
 *  (halftone.glsl.ts). Written this way round so the numbers below are the
 *  ones the caption quotes, rather than opaque 0–1 uniforms that have to be
 *  kept in sync with it by hand. */
const sizeFor = (cells: number) => ((400 - cells) / 393) ** (1 / 0.7)

/** Newsprint's problem: dots you can count. */
const COARSE = 28
/** Coated stock: the structure drops below what the eye resolves. */
const FINE = 180

export function RulingDiagram() {
  // Static uniforms, so HalftoneImage's dirty check draws each canvas once
  // and then idles — nothing here is animated.
  const coarse = useRef<HalftoneUniforms>({ ...DEFAULTS, size: sizeFor(COARSE), contrast: 1.3 })
  const fine = useRef<HalftoneUniforms>({ ...DEFAULTS, size: sizeFor(FINE), contrast: 1.3 })

  // No caption: the remark that used to hang here is the movement's own note
  // now, set between these plates and the prose (content/chapters.json →
  // Chapter.tsx).
  return (
    <Diagram layout="pair" n="Fig. A" title="How coarse is coarse">
      <Plate n="Fig. A1" label={`Coarse · ${COARSE} cells across`}>
        <HalftoneImage
          src="/plates/meisenbach-portrait.jpg"
          alt="A portrait screened at a coarse ruling — the dots are individually visible"
          uniforms={coarse}
        />
      </Plate>
      <Plate n="Fig. A2" label={`Fine · ${FINE} cells across`}>
        <HalftoneImage
          src="/plates/meisenbach-portrait.jpg"
          alt="The same portrait screened at a fine ruling — the dots resolve into tone"
          uniforms={fine}
        />
      </Plate>
    </Diagram>
  )
}
