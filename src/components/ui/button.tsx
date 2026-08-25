import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-md)] text-sm font-medium transition-[transform,background-color,border-color,color] duration-150 [transition-timing-function:var(--ease-out)] cursor-pointer disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        // Primary buttons: Ebony fill, light (Frosted Mint) text — every
        // primary/core-loop action in the app, per docs/Design-System.md.
        default: "bg-primary text-primary-foreground hover:bg-primary/90 hover:-translate-y-px active:translate-y-0",
        destructive:
          "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60 hover:-translate-y-px active:translate-y-0",
        // Secondary buttons: Frosted Mint with a visible Ebony border —
        // transparent alone doesn't separate reliably from the Tea Green
        // card most of these sit on.
        outline:
          "border border-foreground/40 bg-secondary text-foreground hover:bg-accent dark:bg-input/30 dark:border-input dark:hover:bg-input/50 hover:-translate-y-px active:translate-y-0",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 hover:-translate-y-px active:translate-y-0",
        ghost:
          "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        xs: "h-6 gap-1 rounded-[var(--radius-sm)] px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 rounded-[var(--radius-md)] gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-[var(--radius-md)] px-6 has-[>svg]:px-4",
        icon: "size-9 rounded-[var(--radius-md)]",
        "icon-xs": "size-6 rounded-[var(--radius-sm)] [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8 rounded-[var(--radius-md)]",
        "icon-lg": "size-10 rounded-[var(--radius-md)]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const Spinner = () => (
  <span className="inline-block size-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  loading = false,
  children,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
    loading?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"
  const isDisabled = props.disabled ?? loading

  if (asChild) {
    return (
      <Comp
        data-slot="button"
        data-variant={variant}
        data-size={size}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      >
        {children}
      </Comp>
    )
  }

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      disabled={isDisabled}
      {...props}
    >
      {loading && <Spinner />}
      {children}
    </Comp>
  )
}

export { Button, buttonVariants }
