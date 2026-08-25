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
import type { Goal, Task } from "@/lib/data/types";
import { TaskForm } from "./task-form";
import { TaskItem } from "./task-item";

export default function TasksPage() {
  const { adapter, isReady } = useDataAdapter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    const [nextTasks, nextGoals] = await Promise.all([adapter.listTasks(), adapter.listGoals()]);
    setTasks(nextTasks);
    setGoals(nextGoals);
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
          <h1 className="text-h1">Tasks</h1>
          <p className="text-body text-muted-foreground">
            Add tasks and link them to goals. Only active tasks are shown.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/dashboard">← Dashboard</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add a new task</CardTitle>
          <CardDescription>
            Tasks are what you&rsquo;ll get recommendations for.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TaskForm goals={goals} onCreated={refresh} />
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h2 className="text-h2">
          Your tasks ({loaded ? tasks.length : "…"})
        </h2>
        {!loaded ? (
          <p className="text-body text-muted-foreground">Loading…</p>
        ) : tasks.length === 0 ? (
          <EmptyState>
            Nothing on your list yet — add what&rsquo;s on your mind, big or small.
          </EmptyState>
        ) : (
          <div className="space-y-3">
            {tasks.map((task) => (
              <TaskItem key={task.id} task={task} onDeleted={refresh} />
            ))}
          </div>
        )}
      </div>
    </PageSurface>
  );
}
