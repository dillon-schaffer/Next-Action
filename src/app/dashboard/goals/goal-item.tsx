"use client";

import { useState } from "react";

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useDataAdapter } from "@/lib/data/data-context";
import type { Goal } from "@/lib/data/types";

export function GoalItem({ goal, onDeleted }: { goal: Goal; onDeleted: () => void }) {
  const { adapter } = useDataAdapter();
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete() {
    if (
      !confirm(
        "Remove this goal? It will be hidden from your list. Tasks under it will keep their link but the goal won’t show in filters.",
      )
    ) {
      return;
    }
    setIsDeleting(true);
    try {
      await adapter.archiveGoal(goal.id);
      onDeleted();
    } catch {
      alert("Failed to remove goal");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <Card className="transition-[transform,border-color] duration-200 [transition-timing-function:var(--ease-out)] hover:-translate-y-px hover:border-foreground/25">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle>{goal.title}</CardTitle>
            {goal.description && (
              <CardDescription className="mt-1 text-small">
                {goal.description}
              </CardDescription>
            )}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="shrink-0 text-muted-foreground hover:text-destructive"
            onClick={handleDelete}
            disabled={isDeleting}
            loading={isDeleting}
          >
            {isDeleting ? "Removing…" : "Delete"}
          </Button>
        </div>
      </CardHeader>
    </Card>
  );
}
