import type { CSSProperties, ReactNode } from 'react'
import './control.scss'

/** A labeled slider — the diagrams' only input primitive. */
export function Slider({
  label,
  value,
  min,
  max,
  step = 0.01,
  format,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  format?: (v: number) => string
  onChange: (v: number) => void
}) {
  return (
    <label className="ctrl">
      <span className="ctrl__label">{label}</span>
      <input
        className="ctrl__range"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <output className="ctrl__value">{format ? format(value) : value.toFixed(2)}</output>
    </label>
  )
}

/** A row of mutually exclusive options. */
export function Choice<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label?: string
  value: T
  options: Array<{ value: T; label: string }>
  onChange: (v: T) => void
}) {
  return (
    <div className="ctrl ctrl--choice">
      {label && <span className="ctrl__label">{label}</span>}
      {/* Options are laid in equal cells, never wrapped. Four of them in a
          three-column panel used to spill 3 + 1, which reads as an accident
          rather than a set — and the count is data, so the column count comes
          from it rather than from a guess about how wide a word might be.
          Up to three sit in one row; four fold to a square. */}
      <div
        className="ctrl__options"
        style={{ '--opt-cols': options.length > 3 ? 2 : options.length } as CSSProperties}
      >
        {options.map((o) => (
          <button
            key={String(o.value)}
            type="button"
            className="ctrl__opt"
            aria-pressed={o.value === value}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

/**
 * One captioned stage inside a `pair` diagram. The label is the whole
 * apparatus: with no controls to read, the only thing telling you what you
 * are looking at is the line under it.
 */
export function Plate({
  n,
  label,
  children,
}: {
  /** This stage's own reference, sub-numbered off its parent — `Fig. E1`
   *  under `Fig. E`. A pair's two stages are parts of one figure, not two
   *  figures, and they cannot draw from the chapter's plate count anyway:
   *  that counter lives in ChapterView and a diagram is rendered with no
   *  props. */
  n?: string
  label: ReactNode
  children: ReactNode
}) {
  return (
    <figure className="diagram__plate">
      <div className="diagram__stage">{children}</div>
      <figcaption className="diagram__platecap figref">
        {n ? `${n} · ` : ''}
        {label}
      </figcaption>
    </figure>
  )
}

/**
 * The frame every diagram sits in, in one of two layouts.
 *
 * `panel` — one stage and a column of controls beside it. The reader drives
 * the demonstration, so the instrument needs somewhere to live.
 *
 * `pair` — two equal stages, no controls. For a comparison the reader does
 * not need to operate: both states are already on screen, side by side, and
 * a slider would only let them destroy the one arrangement that makes the
 * point. Children are `<Plate>`s.
 *
 * A pair takes no `caption` either, and that is not an omission. The frame is
 * the full width of the screen, so anything hung under it is a line of small
 * type alone on a 1370px row — and the remark a comparison wants to make is
 * about what the two states MEAN, which is the movement's business rather
 * than the figure's. It lives as the movement's `note` instead (Chapter.tsx),
 * on its own row between the pictures and the prose.
 */
export function Diagram({
  n,
  title,
  children,
  controls,
  caption,
  credit,
  layout = 'panel',
}: {
  n: string
  title: string
  children: ReactNode
  /** Required by `panel`, meaningless to `pair`. */
  controls?: ReactNode
  caption?: ReactNode
  /** Attribution for the source on the stage. Its own slot rather than a
   *  sentence inside `caption`: a credit is owed to someone and has to survive
   *  the caption being rewritten, which on these diagrams happens per state. */
  credit?: ReactNode
  layout?: 'panel' | 'pair'
}) {
  // A <span>, not a <strong>. The title was the only bold on the page and it
  // was not marking urgency — it was doing the job the rule under the head
  // already does, which is to say "this block is a figure". One weight, and
  // the reference/title distinction carries on color instead.
  const head = (
    <div className="diagram__head">
      <span className="figref">{n}</span>
      <span className="diagram__title">{title}</span>
    </div>
  )

  if (layout === 'pair') {
    return (
      <figure className="diagram diagram--pair">
        {head}
        {/* The two columns, and the only place their equality is declared —
            the stages themselves carry no width. */}
        <div className="diagram__plates">{children}</div>
      </figure>
    )
  }

  return (
    <figure className="diagram">
      <div className="diagram__stage">{children}</div>
      <div className="diagram__panel">
        {head}
        {controls}
        {caption && <figcaption className="diagram__caption">{caption}</figcaption>}
        {credit && <p className="diagram__credit figref">{credit}</p>}
      </div>
    </figure>
  )
}
