import { Switch as SwitchPrimitive } from "@base-ui/react/switch"

import { cn } from "./utils"

/** Toggle switch, Tweak-styled: the track stays gray and the knob turns black
 * when on (matches the panel's monochrome look — see the Loop toggle). */
function Switch({ className, ...props }: SwitchPrimitive.Root.Props) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full bg-input p-0.5 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="block size-4 rounded-full border border-border bg-background shadow-sm transition-transform data-checked:translate-x-4 data-checked:border-transparent data-checked:bg-primary"
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
