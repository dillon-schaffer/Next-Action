import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          // bg-secondary (Frosted Mint, not transparent, not the page
          // canvas color): inputs must stay a clear, opaque, distinctly
          // lighter "cutout" against the Tea Green card that contains them.
          "flex h-9 w-full rounded-[var(--radius-md)] border border-input bg-secondary px-3 py-1 text-[length:var(--text-body)] text-foreground transition-colors duration-150 [transition-timing-function:var(--ease-out)] file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
