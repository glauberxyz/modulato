/** The house arrow — drawn to sit with the serif, not a glyph. */
export function Arrow({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="20"
      height="13"
      viewBox="0 0 20 13"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M0 6.5H20M20 6.5C16.3181 6.5 13.3333 3.58985 13.3333 0M20 6.5C16.3181 6.5 13.3333 9.41015 13.3333 13"
        stroke="currentColor"
      />
    </svg>
  )
}
