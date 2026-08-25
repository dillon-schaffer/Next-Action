"use client";

import { useEffect, useState } from "react";

import { useDataAdapter } from "@/lib/data/data-context";

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getUTCFullYear() === now.getUTCFullYear() &&
    d.getUTCMonth() === now.getUTCMonth() &&
    d.getUTCDate() === now.getUTCDate()
  );
}

/**
 * A small, honest "you're making progress" line — a real count of next
 * actions accepted today, not points or a streak. Shows nothing at zero;
 * a quiet moment of momentum only appears once it's true.
 */
export function MomentumIndicator({ refreshKey }: { refreshKey: number }) {
  const { adapter, isReady } = useDataAdapter();
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    if (!isReady) return;
    let cancelled = false;
    (async () => {
      try {
        const history = await adapter.listSuggestionHistory();
        if (cancelled) return;
        const today = history.filter((h) => h.decision === "accepted" && isToday(h.createdAt)).length;
        setCount(today);
      } catch {
        if (!cancelled) setCount(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [adapter, isReady, refreshKey]);

  if (!count) return null;

  return (
    <p className="animate-card-in flex items-center gap-1.5 text-small text-muted-foreground">
      <span className="size-1.5 rounded-full bg-primary" aria-hidden />
      {count} next {count === 1 ? "action" : "actions"} started today
    </p>
  );
}
