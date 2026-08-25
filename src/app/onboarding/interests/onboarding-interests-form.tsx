"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useDataAdapter } from "@/lib/data/data-context";

const DEFAULT_INTERESTS = [
  "building side projects",
  "coding",
  "design",
  "writing",
  "fitness",
  "reading",
  "music",
  "gaming",
  "cooking",
  "learning",
  "productivity",
  "entrepreneurship",
  "art",
  "photography",
  "volunteering",
  "outdoor time",
  "career prep",
  "personal finance",
  "mindfulness",
];

function normalizeKey(label: string): string {
  return label.trim().toLowerCase();
}

function dedupeByKey(labels: string[]): string[] {
  const byLower = new Map<string, string>();
  for (const label of labels) {
    const key = normalizeKey(label);
    if (!byLower.has(key)) byLower.set(key, label.trim());
  }
  return Array.from(byLower.values());
}

export function OnboardingInterestsForm({
  isEditing = false,
  initialInterests = [],
}: {
  isEditing?: boolean;
  initialInterests?: string[];
}) {
  const router = useRouter();
  const { adapter } = useDataAdapter();
  const [yourInterests, setYourInterests] = useState<string[]>(() =>
    dedupeByKey(initialInterests.map((l) => l.trim()).filter(Boolean)),
  );
  const [customInput, setCustomInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPersisting, setIsPersisting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const suggestedToShow = DEFAULT_INTERESTS.filter(
    (label) =>
      !yourInterests.some((y) => normalizeKey(y) === normalizeKey(label)),
  );

  const persistInterests = useCallback(async (list: string[]) => {
    const payload = dedupeByKey(list);
    setIsPersisting(true);
    setError(null);
    try {
      await adapter.setInterests(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsPersisting(false);
    }
  }, [adapter]);

  const addFromSuggested = useCallback(
    (label: string) => {
      const key = normalizeKey(label);
      if (yourInterests.some((y) => normalizeKey(y) === key)) return;
      const next = dedupeByKey([...yourInterests, label]);
      setYourInterests(next);
      persistInterests(next);
    },
    [yourInterests, persistInterests],
  );

  const removeFromYours = useCallback(
    (label: string) => {
      const key = normalizeKey(label);
      const next = yourInterests.filter((y) => normalizeKey(y) !== key);
      setYourInterests(next);
      persistInterests(next);
    },
    [yourInterests, persistInterests],
  );

  const addFromInput = useCallback(() => {
    const trimmed = customInput.trim();
    if (!trimmed) return;
    const key = normalizeKey(trimmed);
    if (yourInterests.some((y) => normalizeKey(y) === key)) {
      setCustomInput("");
      return;
    }
    const next = dedupeByKey([...yourInterests, trimmed]);
    setYourInterests(next);
    setCustomInput("");
    persistInterests(next);
  }, [customInput, yourInterests, persistInterests]);

  const handleContinue = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      await adapter.setInterests(dedupeByKey(yourInterests));
      await adapter.markOnboardingComplete();
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      await adapter.markOnboardingComplete();
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardContent className="space-y-6">
        {/* Your Interests */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            Your interests
          </p>
          <div className="flex flex-wrap gap-2">
            {yourInterests.length === 0 ? (
              <span className="text-sm text-muted-foreground">
                None yet — add from suggestions below or type your own.
              </span>
            ) : (
              yourInterests.map((label) => (
                <span
                  key={normalizeKey(label)}
                  className="animate-card-in inline-flex items-center gap-1.5 rounded-[var(--radius-lg)] border border-foreground/20 bg-frosted-mint px-4 py-2 text-sm font-medium text-foreground"
                >
                  {label}
                  <button
                    type="button"
                    onClick={() => removeFromYours(label)}
                    disabled={isPersisting}
                    className="ml-0.5 rounded-[var(--radius-lg)] p-0.5 hover:bg-foreground/10 focus:outline-none focus:ring-2 focus:ring-foreground/30 cursor-pointer disabled:opacity-50"
                    aria-label={`Remove ${label}`}
                  >
                    <span className="sr-only">Remove</span>
                    <span aria-hidden>×</span>
                  </button>
                </span>
              ))
            )}
          </div>
        </div>

        {/* Add new interest */}
        <div className="flex gap-2">
          <Input
            type="text"
            placeholder="Add an interest…"
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addFromInput();
              }
            }}
            className="flex-1"
          />
          <Button
            type="button"
            variant="outline"
            onClick={addFromInput}
            disabled={isPersisting}
          >
            Add
          </Button>
        </div>

        {/* Suggested Interests (first-time only) */}
        {!isEditing && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              Suggested interests
            </p>
            <div className="flex flex-wrap gap-2">
              {suggestedToShow.map((label) => (
                <button
                  key={normalizeKey(label)}
                  type="button"
                  onClick={() => addFromSuggested(label)}
                  disabled={isPersisting}
                  className="rounded-[var(--radius-lg)] border border-foreground/15 px-4 py-2 text-sm font-medium transition-[background-color,transform] duration-150 [transition-timing-function:var(--ease-out)] cursor-pointer bg-muted text-muted-foreground hover:bg-accent hover:-translate-y-px disabled:opacity-50 disabled:hover:translate-y-0"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {isPersisting && !error && (
          <p className="text-sm text-muted-foreground">Saving…</p>
        )}
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {isEditing ? (
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard">Back to dashboard</Link>
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              onClick={handleSkip}
              disabled={isSubmitting}
              loading={isSubmitting}
            >
              Skip for now
            </Button>
          )}
          <Button
            type="button"
            onClick={handleContinue}
            disabled={isSubmitting}
            loading={isSubmitting}
          >
            {isSubmitting ? "Saving…" : isEditing ? "Save" : "Continue"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
