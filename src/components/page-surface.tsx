import { cn } from "@/lib/utils";

/**
 * The Frosted Mint content panel every page's content sits inside, on top
 * of the Frozen Water page canvas. This is the layer that was missing
 * before — without it, only individual cards were colored and the rest of
 * the page read as plain white/near-white next to them.
 */
export function PageSurface({
  className,
  maxWidth = "max-w-3xl",
  children,
}: {
  className?: string;
  maxWidth?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="px-3 py-6 sm:px-6 sm:py-10">
      <div
        className={cn(
          "animate-card-in mx-auto flex w-full flex-col gap-6 rounded-[var(--radius-lg)] border border-foreground/10 bg-secondary p-4 sm:p-6",
          maxWidth,
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}
