"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useDataAdapter } from "@/lib/data/data-context";

export function GoalForm({ onCreated }: { onCreated: () => void }) {
  const { adapter } = useDataAdapter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      await adapter.createGoal({ title, description: description || undefined });
      setTitle("");
      setDescription("");
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
          placeholder="e.g., Launch MVP"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="description" className="text-sm font-medium">
          Description (optional)
        </label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={2000}
          rows={3}
          className="w-full rounded-[var(--radius-md)] border border-input bg-secondary px-3 py-2 text-[length:var(--text-body)] text-foreground ring-offset-background transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [transition-timing-function:var(--ease-out)]"
          placeholder="What's this goal about?"
        />
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <Button type="submit" loading={isSubmitting}>
        {isSubmitting ? "Creating…" : "Create goal"}
      </Button>
    </form>
  );
}
