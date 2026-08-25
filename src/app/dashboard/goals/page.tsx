"use client";

import { useCallback, useEffect, useState } from "react";
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
import { useDataAdapter } from "@/lib/data/data-context";
import type { Goal } from "@/lib/data/types";
import { GoalForm } from "./goal-form";
import { GoalItem } from "./goal-item";

export default function GoalsPage() {
  const { adapter, isReady } = useDataAdapter();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    setGoals(await adapter.listGoals());
    setLoaded(true);
  }, [adapter]);

  useEffect(() => {
    if (!isReady) return;
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      await refresh();
    })();
    return () => {
      cancelled = true;
    };
  }, [isReady, refresh]);

  return (
    <PageSurface maxWidth="max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-h1">Goals</h1>
          <p className="text-body text-muted-foreground">
            Organize your work into goals, then add tasks to each.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/dashboard">← Dashboard</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add a new goal</CardTitle>
          <CardDescription>
            Goals help you group related tasks together.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <GoalForm onCreated={refresh} />
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h2 className="text-h2">
          Your goals ({loaded ? goals.length : "…"})
        </h2>
        {!loaded ? (
          <p className="text-body text-muted-foreground">Loading…</p>
        ) : goals.length === 0 ? (
          <EmptyState>
            No goals yet. They&rsquo;re optional — a place to group related tasks once a few show up.
          </EmptyState>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {goals.map((goal) => (
              <GoalItem key={goal.id} goal={goal} onDeleted={refresh} />
            ))}
          </div>
        )}
      </div>
    </PageSurface>
  );
}
