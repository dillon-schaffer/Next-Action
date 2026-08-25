"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MomentumIndicator } from "@/components/momentum-indicator";
import { formatTimeMinutes } from "@/lib/time";
import { useDataAdapter } from "@/lib/data/data-context";
import type { RecommendationResponse } from "@/lib/data/types";
import { ContextForm } from "./context-form";

function RecommendationSkeleton() {
  return (
    <Card className="border-l-4 border-l-foreground/20" aria-hidden aria-busy="true">
      <CardHeader>
        <div className="animate-shimmer h-5 w-40 rounded" />
        <div className="animate-shimmer h-3.5 w-56 rounded" />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="animate-shimmer h-5 w-3/4 rounded" />
        <div className="space-y-2">
          <div className="animate-shimmer h-3.5 w-full rounded" />
          <div className="animate-shimmer h-3.5 w-2/3 rounded" />
        </div>
        <div className="flex gap-2">
          <div className="animate-shimmer h-9 w-32 rounded-[var(--radius-md)]" />
          <div className="animate-shimmer h-9 w-20 rounded-[var(--radius-md)]" />
        </div>
      </CardContent>
    </Card>
  );
}

export function DashboardClient() {
  const { adapter } = useDataAdapter();
  const [result, setResult] = useState<RecommendationResponse | null>(null);
  const [isRequesting, setIsRequesting] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [isSkipping, setIsSkipping] = useState(false);
  const [addedMessage, setAddedMessage] = useState<string | null>(null);
  const [momentumTick, setMomentumTick] = useState(0);

  function handleRecommendation(response: RecommendationResponse) {
    setResult(response);
    setAddedMessage(null);
  }

  async function handleAddToTasks() {
    if (!result || !("type" in result) || result.type !== "generated") return;

    setIsAdding(true);
    setAddedMessage(null);
    try {
      await adapter.confirmSuggestion(result.recommendationId);
      setAddedMessage("Added. It's in your Tasks list.");
      setResult(null);
      setMomentumTick((n) => n + 1);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsAdding(false);
    }
  }

  async function handleSkip() {
    if (!result || !("type" in result) || result.type !== "generated") return;

    setIsSkipping(true);
    try {
      await adapter.skipSuggestion(result.recommendationId);
      setResult(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsSkipping(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <MomentumIndicator refreshKey={momentumTick} />

      <Card>
        <CardHeader>
          <CardTitle>Set your context</CardTitle>
          <CardDescription>
            Share your time, energy, and focus so we can suggest one thing to do next.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ContextForm onRecommendation={handleRecommendation} onLoadingChange={setIsRequesting} />
        </CardContent>
      </Card>

      {addedMessage && (
        <p className="animate-card-in flex items-center gap-2 text-sm text-muted-foreground">
          <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground" aria-hidden>
            ✓
          </span>
          {addedMessage}
        </p>
      )}

      {isRequesting && <RecommendationSkeleton />}

      {!isRequesting && result && "type" in result && result.type === "generated" && (
        <Card className="border-l-4 border-l-foreground">
          <CardHeader>
            <CardTitle>Your next action</CardTitle>
            <CardDescription>
              Suggested for you; not on your list yet.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="rounded border border-foreground/20 bg-frosted-mint px-2 py-0.5 text-xs font-medium text-foreground">
                AI-suggested
              </span>
            </div>
            <div>
              <h3 className="text-h2">{result.generatedTask.title}</h3>
              <p className="mt-1 text-body font-medium text-muted-foreground">
                Do this next: {result.generatedTask.nextAction}
              </p>
              <p className="mt-2 text-body text-muted-foreground">
                Why now: {result.generatedTask.reasoning}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-small text-muted-foreground">
              <span>About {formatTimeMinutes(result.generatedTask.estimatedMinutes)}</span>
              {result.generatedTask.tags?.length > 0 && (
                <>
                  <span>·</span>
                  <span>{result.generatedTask.tags.join(", ")}</span>
                </>
              )}
              <span>·</span>
              <span className="inline-flex items-center gap-1.5 rounded border border-foreground/20 bg-frosted-mint px-2 py-0.5 text-foreground">
                <span
                  className={`size-1.5 rounded-full ${
                    result.generatedTask.confidence === "high"
                      ? "bg-primary"
                      : result.generatedTask.confidence === "med"
                        ? "bg-light-blue"
                        : "bg-foreground/25"
                  }`}
                  aria-hidden
                />
                {result.generatedTask.confidence} confidence
              </span>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleAddToTasks}
                disabled={isAdding || isSkipping}
                loading={isAdding}
              >
                {isAdding ? "Adding…" : "Add to my tasks"}
              </Button>
              <Button
                variant="outline"
                onClick={handleSkip}
                disabled={isAdding || isSkipping}
                loading={isSkipping}
              >
                {isSkipping ? "Skipping…" : "Skip"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!isRequesting && result && "fallback" in result && (
        <Card className="border-l-4 border-l-light-blue bg-frozen-water">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              {result.fallback.message}
              {result.fallback.deterministicIdea ? (
                <>{" "}<span className="font-medium text-foreground">{result.fallback.deterministicIdea}</span></>
              ) : null}
            </p>
          </CardContent>
        </Card>
      )}

      {!isRequesting && result && "dailyLimitReached" in result && result.dailyLimitReached && (
        <Card className="border-l-4 border-l-light-blue bg-frozen-water">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              {"message" in result ? result.message : "You've reached your 5 AI suggestions for today. Try again tomorrow."}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
