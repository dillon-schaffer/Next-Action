"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useDataAdapter } from "@/lib/data/data-context";
import type { Goal } from "@/lib/data/types";

export function TaskForm({ goals, onCreated }: { goals: Goal[]; onCreated: () => void }) {
  const { adapter } = useDataAdapter();
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [goalId, setGoalId] = useState("");
  const [estimatedInput, setEstimatedInput] = useState("");
  const [priority, setPriority] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const body: Parameters<typeof adapter.createTask>[0] = {
        title,
        notes: notes || undefined,
        goalId: goalId || undefined,
      };

      if (estimatedInput.trim()) {
        body.estimatedInput = estimatedInput.trim();
      }
      if (priority) {
        body.priority = parseInt(priority, 10);
      }

      await adapter.createTask(body);

      setTitle("");
      setNotes("");
      setGoalId("");
      setEstimatedInput("");
      setPriority("");
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="title" className="text-sm font-medium">
          Title *
        </label>
        <input
          id="title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          maxLength={200}
          className="w-full rounded-[var(--radius-md)] border border-input bg-secondary px-3 py-2 text-[length:var(--text-body)] text-foreground ring-offset-background transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [transition-timing-function:var(--ease-out)]"
          placeholder="e.g., Write recommendation rules"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="notes" className="text-sm font-medium">
          Notes (optional)
        </label>
        <textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={4000}
          rows={3}
          className="w-full rounded-[var(--radius-md)] border border-input bg-secondary px-3 py-2 text-[length:var(--text-body)] text-foreground ring-offset-background transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [transition-timing-function:var(--ease-out)]"
          placeholder="Any additional context..."
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="goalId" className="text-sm font-medium">
            Goal (optional)
          </label>
          <select
            id="goalId"
            value={goalId}
            onChange={(e) => setGoalId(e.target.value)}
            className="w-full rounded-[var(--radius-md)] border border-input bg-secondary px-3 py-2 text-[length:var(--text-body)] text-foreground ring-offset-background transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [transition-timing-function:var(--ease-out)]"
          >
            <option value="">None</option>
            {goals.map((goal) => (
              <option key={goal.id} value={goal.id}>
                {goal.title}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label htmlFor="estimatedInput" className="text-sm font-medium">
            Time estimate (optional)
          </label>
          <input
            id="estimatedInput"
            type="text"
            value={estimatedInput}
            onChange={(e) => setEstimatedInput(e.target.value)}
            className="w-full rounded-[var(--radius-md)] border border-input bg-secondary px-3 py-2 text-[length:var(--text-body)] text-foreground ring-offset-background transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [transition-timing-function:var(--ease-out)]"
            placeholder="e.g. 45m, 2h, 1d"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="priority" className="text-sm font-medium">
            Priority 1-5 (optional)
          </label>
          <input
            id="priority"
            type="number"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            min="1"
            max="5"
            className="w-full rounded-[var(--radius-md)] border border-input bg-secondary px-3 py-2 text-[length:var(--text-body)] text-foreground ring-offset-background transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [transition-timing-function:var(--ease-out)]"
            placeholder="1-5"
          />
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" loading={isSubmitting}>
        {isSubmitting ? "Creating…" : "Create task"}
      </Button>
    </form>
  );
}
