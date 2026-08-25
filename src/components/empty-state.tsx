/**
 * Empty-state panel — part of the same secondary/status family as the
 * fallback and daily-limit cards (Frozen Water + a Light Blue stripe), not
 * a separate one-off treatment.
 */
export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="animate-card-in rounded-[var(--radius-md)] border border-foreground/12 border-l-4 border-l-light-blue bg-frozen-water px-4 py-6 text-body text-foreground">
      {children}
    </div>
  );
}
