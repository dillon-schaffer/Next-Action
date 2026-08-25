"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { parseTimeInput, formatTimeMinutes } from "@/lib/time";
import { useDataAdapter } from "@/lib/data/data-context";
import type { RecommendationResponse } from "@/lib/data/types";

export type { RecommendationResponse, GeneratedTask } from "@/lib/data/types";

const TOGGLE_BASE =
  "flex-1 rounded-[var(--radius-md)] border px-3 py-2 text-[length:var(--text-body)] transition-[background-color,border-color,color,transform] duration-200 cursor-pointer [transition-timing-function:var(--ease-out)] hover:-translate-y-px active:translate-y-0";
// Selected = the rich, full-strength Tea Green (not Ebony) — Ebony stays
// reserved for the one primary submit action per screen so selecting an
// option doesn't read as "committing" the same way pressing the button does.
const TOGGLE_SELECTED = "border-2 border-foreground bg-tea-green text-foreground py-[calc(0.5rem-1px)]";
const TOGGLE_UNSELECTED = "border-input bg-secondary text-foreground hover:bg-accent";

export function ContextForm({
  onRecommendation,
  onLoadingChange,
}: {
  onRecommendation: (result: RecommendationResponse) => void;
  onLoadingChange?: (loading: boolean) => void;
}) {
  const { adapter } = useDataAdapter();
  const [timeInput, setTimeInput] = useState("60");
  const [energy, setEnergy] = useState<"low" | "med" | "high">("med");
  const [uniqueness, setUniqueness] = useState<"familiar" | "related" | "novel">("related");
  const [hasIdea, setHasIdea] = useState(false);
  const [ideaHint, setIdeaHint] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsedMinutes = parseTimeInput(timeInput);
  const timeDisplay = parsedMinutes != null ? formatTimeMinutes(parsedMinutes) : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    onLoadingChange?.(true);
    setError(null);

    try {
      let timeMinutes: number;
      const fromParser = parseTimeInput(timeInput);
      if (fromParser != null) {
        timeMinutes = fromParser;
      } else {
        const num = parseFloat(timeInput.trim());
        if (!Number.isFinite(num) || num <= 0) {
          throw new Error("Enter time as a number or e.g. 45m, 2h, 1d");
        }
        timeMinutes = Math.round(num);
      }

      const result = await adapter.requestRecommendation({
        timeInput: timeInput.trim(),
        timeMinutes,
        energy,
        uniqueness,
        ideaHint: hasIdea && ideaHint.trim() ? ideaHint.trim() : undefined,
      });

      onRecommendation(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsLoading(false);
      onLoadingChange?.(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="timeInput" className="text-sm font-medium">
          Available time *
        </label>
        <input
          id="timeInput"
          type="text"
          value={timeInput}
          onChange={(e) => setTimeInput(e.target.value)}
          required
          className="w-full rounded-[var(--radius-md)] border border-input bg-secondary px-3 py-2 text-[length:var(--text-body)] text-foreground ring-offset-background transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [transition-timing-function:var(--ease-out)]"
          placeholder="e.g. 45m, 2h, 1d or 60"
        />
        {timeDisplay != null && (
          <p className="text-xs text-muted-foreground">
            {timeDisplay}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Energy level *</label>
        <div className="flex gap-2">
          {(["low", "med", "high"] as const).map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => setEnergy(level)}
              className={`${TOGGLE_BASE} ${energy === level ? TOGGLE_SELECTED : TOGGLE_UNSELECTED}`}
            >
              {level.charAt(0).toUpperCase() + level.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Uniqueness *</label>
        <div className="flex gap-2">
          {([
            { value: "familiar", label: "Familiar" },
            { value: "related", label: "Related" },
            { value: "novel", label: "Novel" },
          ] as const).map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setUniqueness(value)}
              className={`${TOGGLE_BASE} ${uniqueness === value ? TOGGLE_SELECTED : TOGGLE_UNSELECTED}`}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Familiar: same kind of task I&rsquo;ve done before. Related: similar/adjacent to what I&rsquo;ve done. Novel: completely new task/skill I haven&rsquo;t tried.
        </p>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Have an idea already?</label>
        <div className="flex gap-2">
          {(["No", "Yes"] as const).map((choice) => (
            <button
              key={choice}
              type="button"
              onClick={() => setHasIdea(choice === "Yes")}
              className={`${TOGGLE_BASE} ${
                (choice === "Yes" && hasIdea) || (choice === "No" && !hasIdea) ? TOGGLE_SELECTED : TOGGLE_UNSELECTED
              }`}
            >
              {choice}
            </button>
          ))}
        </div>
        {/* Grid-rows expand/collapse: animates smoothly without measuring height in JS. */}
        <div
          className={`grid transition-[grid-template-rows] duration-200 [transition-timing-function:var(--ease-out)] ${
            hasIdea ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
          }`}
        >
          <div className="space-y-2 overflow-hidden">
            <input
              type="text"
              value={ideaHint}
              onChange={(e) => setIdeaHint(e.target.value)}
              maxLength={500}
              tabIndex={hasIdea ? 0 : -1}
              className="w-full rounded-[var(--radius-md)] border border-input bg-secondary px-3 py-2 text-[length:var(--text-body)] text-foreground ring-offset-background transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [transition-timing-function:var(--ease-out)]"
              placeholder="e.g. something outside, something productive, something relaxing"
            />
            <p className="text-xs text-muted-foreground">
              Optional: tell the assistant what kind of task you&rsquo;re in the mood for. It&rsquo;ll use this as a hint.
            </p>
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button
        type="submit"
        loading={isLoading}
        className="w-full cursor-pointer"
      >
        {isLoading ? "Finding a suggestion for you…" : "Get recommendation"}
      </Button>
    </form>
  );
}
