import { Switch as SwitchPrimitive } from "@base-ui/react/switch"

import { cn } from "./utils"

/** Toggle switch, Tweak-styled: the track stays gray and the knob turns black
 * when on (matches the panel's monochrome look — see the Loop toggle). */
function Switch({
  className,
  size = "default",
  ...props
}: SwitchPrimitive.Root.Props & { size?: "default" | "sm" }) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "inline-flex shrink-0 cursor-pointer items-center rounded-full bg-input p-0.5 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" ? "h-4 w-7" : "h-5 w-9",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "block rounded-full border border-border bg-background shadow-sm transition-transform data-checked:border-transparent data-checked:bg-primary",
          size === "sm" ? "size-3 data-checked:translate-x-3" : "size-4 data-checked:translate-x-4"
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
