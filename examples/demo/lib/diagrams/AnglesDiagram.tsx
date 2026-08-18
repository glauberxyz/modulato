import { useRef, useState } from 'react'
import { HalftoneImage } from '../HalftoneCanvas'
import { DEFAULTS, beatCells, type HalftoneUniforms } from '../halftone'
import { Choice, Diagram, Slider } from '../Control'
import './diagrams.scss'

const STANDARD: [number, number, number, number] = [15, 75, 0, 45]
const PRESETS: Record<string, [number, number, number, number]> = {
  standard: STANDARD,
  same: [45, 45, 45, 45],
  close: [15, 17, 0, 45],
  random: [8, 52, 31, 67],
}

const NAMES = ['Cyan', 'Magenta', 'Yellow', 'Black']

/**
 * The headline interaction. Four screen angles, live, with the beat
 * wavelength computed for every pair — the number that explains why
 * 15/75/0/45 are not arbitrary.
 */
export function AnglesDiagram() {
  const [angles, setAngles] = useState<[number, number, number, number]>(STANDARD)
  const uniforms = useRef<HalftoneUniforms>({
    ...DEFAULTS,
    size: 0.52,
    contrast: 1.35,
    softness: 0.05,
    angles: STANDARD,
    // No `tone`. A real color photograph separates onto all four plates on
    // its own — C 12 / M 10 / Y 22 / K 44 across this frame, because the
    // largest channel is red over 58% of it, blue over 33% and green over 9%.
    // Toning it would be inventing color underneath the very separation the
    // diagram exists to show. The uniform stays in the shader for monochrome
    // sources, which cannot separate into anything but black.
    cover: true,
  })

  const set = (i: number, v: number) => {
    const next = [...angles] as [number, number, number, number]
    next[i] = v
    setAngles(next)
    uniforms.current.angles = next
  }
  const preset = (k: string) => {
    const next = PRESETS[k]
    setAngles(next)
    uniforms.current.angles = next
  }

  // The tightest beat across all six pairs is what your eye actually sees.
  let worst = Infinity
  let worstPair = ''
  for (let a = 0; a < 4; a++) {
    for (let b = a + 1; b < 4; b++) {
      const cells = beatCells(angles[a], angles[b])
      if (cells > worst) continue
      worst = cells
      worstPair = `${NAMES[a][0]}–${NAMES[b][0]}`
    }
  }
  const bad = worst > 6

  return (
    <Diagram
      n="Fig. C"
      title="Turn the screens"
      controls={
        <>
          <Choice
            label="Preset"
            value={
              (Object.keys(PRESETS).find(
                (k) => PRESETS[k].join() === angles.join(),
              ) as string) ?? 'custom'
            }
            options={[
              { value: 'standard', label: 'Standard' },
              { value: 'same', label: 'All 45°' },
              { value: 'close', label: '2° apart' },
              { value: 'random', label: 'Random' },
            ]}
            onChange={preset}
          />
          {NAMES.map((n, i) => (
            <Slider
              key={n}
              label={n}
              value={angles[i]}
              min={0}
              max={90}
              step={1}
              format={(v) => `${v.toFixed(0)}°`}
              onChange={(v) => set(i, v)}
            />
          ))}
          <p className={`angles__beat ${bad ? 'is-bad' : ''}`}>
            <span className="label">Tightest beat</span>
            <strong>
              {worst === Infinity ? 'identical screens' : `${worst.toFixed(1)} cells`}
            </strong>
            <span className="angles__pair">{worstPair}</span>
          </p>
        </>
      }
      caption={
        bad
          ? 'A beat this coarse is visible as banding. This is moiré — the pattern that is in neither screen, only in their difference.'
          : 'Below about six cells the beat reads as texture, not pattern. That texture is the rosette.'
      }
      credit="“Eve” (2008) by Alex Prager."
    >
      <HalftoneImage
        src="/plates/prager-eve-2008.jpg"
        alt="A figure on an open road with pigeons scattering around them against a blue sky and electricity pylons, screened at the current plate angles"
        uniforms={uniforms}
      />
    </Diagram>
  )
}
