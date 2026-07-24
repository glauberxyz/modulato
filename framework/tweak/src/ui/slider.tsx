import type { ReactNode } from "react"
import { Slider as SliderPrimitive } from "@base-ui/react/slider"

import { cn } from "./utils"

/**
 * Filled-track slider with its label INSIDE the track — Tweak's condensed row
 * design: the whole pill is the hit target, the fill marks the value, no
 * visible thumb (keyboard focus shows a hairline caret instead).
 */
function Slider({
  className,
  label,
  ...props
}: SliderPrimitive.Root.Props & { label?: ReactNode }) {
  return (
    <SliderPrimitive.Root
      className={cn("min-w-0", className)}
      data-slot="slider"
      thumbAlignment="edge"
      {...props}
    >
      <SliderPrimitive.Control className="relative flex w-full touch-none items-center select-none data-disabled:opacity-50">
        <SliderPrimitive.Track
          data-slot="slider-track"
          className="relative h-9 w-full grow overflow-hidden rounded-full bg-secondary/50 select-none"
        >
          <SliderPrimitive.Indicator
            data-slot="slider-range"
            className="bg-foreground/10 select-none data-horizontal:h-full"
          />
          {label != null && (
            <span className="pointer-events-none absolute inset-y-0 left-3.5 z-10 flex max-w-[80%] items-center truncate text-xs text-foreground">
              {label}
            </span>
          )}
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb
          data-slot="slider-thumb"
          className="block h-5 w-1 shrink-0 rounded-full bg-transparent outline-none focus-visible:bg-foreground/50"
        />
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  )
}

export { Slider }
