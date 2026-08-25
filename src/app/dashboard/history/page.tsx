"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { PageSurface } from "@/components/page-surface";
import { formatTimeMinutes } from "@/lib/time";
import { useDataAdapter } from "@/lib/data/data-context";
import type { SuggestionHistoryItem } from "@/lib/data/types";

export default function HistoryPage() {
  const { adapter, isReady } = useDataAdapter();
  const [items, setItems] = useState<SuggestionHistoryItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!isReady) return;
    let cancelled = false;
    (async () => {
      const history = await adapter.listSuggestionHistory();
      if (!cancelled) {
        setItems(history);
        setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [adapter, isReady]);

  return (
    <PageSurface maxWidth="max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-h1">
            Recommendation History
          </h1>
          <p className="text-body text-muted-foreground">
            Your recent recommendations and decisions.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/dashboard">← Dashboard</Link>
        </Button>
      </div>

      {!loaded ? (
        <p className="text-body text-muted-foreground">Loading…</p>
      ) : items.length === 0 ? (
        <EmptyState>
          No history yet — once you accept or skip a suggestion, it&rsquo;ll show up here.
        </EmptyState>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <Card
              key={item.id}
              className="border-l-4 border-l-light-blue bg-frozen-water transition-[transform,border-color] duration-200 [transition-timing-function:var(--ease-out)] hover:-translate-y-px hover:border-foreground/25"
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle>
                      {item.title}
                    </CardTitle>
                    <CardDescription className="mt-1 text-small">
                      {item.reasoning}
                    </CardDescription>
                  </div>
                  <span
                    className={`shrink-0 rounded px-2 py-1 text-xs font-medium ${
                      item.decision === "accepted"
                        ? "border border-foreground/30 bg-tea-green text-foreground"
                        : item.decision === "skipped"
                          ? "border border-foreground/30 text-foreground"
                          : "bg-frosted-mint text-foreground"
                    }`}
                  >
                    {item.decision === "accepted"
                      ? "Accepted"
                      : item.decision === "skipped"
                        ? "Skipped"
                        : "Pending"}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-4 text-small text-muted-foreground">
                  <span>
                    Time: {formatTimeMinutes(item.contextTimeMinutes)}
                  </span>
                  <span>
                    Energy: {item.contextEnergy}
                  </span>
                  {item.contextUniqueness && (
                    <span>
                      Uniqueness: {item.contextUniqueness}
                    </span>
                  )}
                  <span>
                    {new Date(item.createdAt).toLocaleString()}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </PageSurface>
  );
}
