import type { ReactNode } from 'react'
import './control.scss'

/** A labelled slider — the diagrams' only input primitive. */
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
      <div className="ctrl__options">
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

/** The frame every interactive diagram sits in. */
export function Diagram({
  n,
  title,
  children,
  controls,
  caption,
}: {
  n: string
  title: string
  children: ReactNode
  controls: ReactNode
  caption?: ReactNode
}) {
  return (
    <figure className="diagram">
      <div className="diagram__stage">{children}</div>
      <div className="diagram__panel">
        <div className="diagram__head">
          <span className="figref">{n}</span>
          <strong className="diagram__title">{title}</strong>
        </div>
        {controls}
        {caption && <figcaption className="diagram__caption">{caption}</figcaption>}
      </div>
    </figure>
  )
}
