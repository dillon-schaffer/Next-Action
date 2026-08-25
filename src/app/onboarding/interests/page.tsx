"use client";

import { useEffect, useState } from "react";

import { PageSurface } from "@/components/page-surface";
import { useDataAdapter } from "@/lib/data/data-context";
import { OnboardingInterestsForm } from "./onboarding-interests-form";

export default function OnboardingInterestsPage() {
  const { adapter, isReady } = useDataAdapter();
  const [initialInterests, setInitialInterests] = useState<string[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!isReady) return;
    let cancelled = false;
    (async () => {
      const status = await adapter.getOnboardingStatus();
      // Load whatever's already saved even if onboarding isn't "complete" yet —
      // interests persist as soon as they're added, before Continue is clicked.
      const interests = await adapter.listInterests();
      if (cancelled) return;
      setIsEditing(status.completed);
      setInitialInterests(interests);
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [adapter, isReady]);

  if (!isReady || !loaded) {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4">
        <p className="text-body text-muted-foreground">Loading…</p>
      </div>
    );
  }

  return (
    <PageSurface maxWidth="max-w-2xl">
      <div className="space-y-1 border-b border-foreground/15 pb-5">
        <h1 className="text-h1">
          {isEditing ? "Edit your interests" : "What are you interested in?"}
        </h1>
        <p className="text-body text-muted-foreground">
          We’ll use this to suggest relevant next actions. You can change it
          later.
        </p>
      </div>
      <OnboardingInterestsForm
        isEditing={isEditing}
        initialInterests={initialInterests}
      />
    </PageSurface>
  );
}
