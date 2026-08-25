"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { SyncStatus } from "@/components/sync-status";
import { MigrationBanner } from "@/components/migration-banner";
import { PageSurface } from "@/components/page-surface";
import { useDataAdapter } from "@/lib/data/data-context";
import { DashboardClient } from "./dashboard-client";

export default function DashboardPage() {
  const router = useRouter();
  const { adapter, isReady } = useDataAdapter();
  const [interestsCount, setInterestsCount] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!isReady) return;
    let cancelled = false;

    (async () => {
      try {
        const status = await adapter.getOnboardingStatus();
        if (cancelled) return;
        if (!status.completed) {
          router.replace("/onboarding/interests");
          return;
        }
        setInterestsCount(status.interestsCount);
        setChecked(true);
      } catch {
        // Signed-in fetch failed (e.g. network blip) — still let the user in
        // rather than trap them behind a loading state.
        if (!cancelled) setChecked(true);
      }
    })();

    return () => {
      cancelled = true;
    };
    // adapter identity changes when guest/signed-in mode flips; re-check then.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adapter, isReady]);

  if (!isReady || !checked) {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4">
        <p className="text-body text-muted-foreground">Loading your dashboard…</p>
      </div>
    );
  }

  return (
    <PageSurface>
      <MigrationBanner />

      {interestsCount === 0 && (
        <div className="rounded-[var(--radius-md)] border-l-4 border-l-light-blue bg-frozen-water px-4 py-3 text-body text-foreground">
          A few interests help us suggest things you&rsquo;ll actually want to do.{" "}
          <a
            href="/onboarding/interests"
            className="font-medium underline underline-offset-2 hover:no-underline"
          >
            Set your interests
          </a>
        </div>
      )}

      <div className="flex flex-col gap-4 border-b border-foreground/15 pb-5">
        <div className="flex flex-col gap-2 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-h1 font-semibold">Your next action</h1>
            <SyncStatus />
          </div>
          <p className="text-body text-muted-foreground">
            Set your context and get a recommendation for what to work on next.
          </p>
        </div>
        <nav className="flex flex-wrap gap-1 -ml-2 shrink-0">
          <Button asChild variant="ghost" size="sm">
            <a href="/dashboard/goals">Goals</a>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <a href="/dashboard/tasks">Tasks</a>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <a href="/dashboard/history">History</a>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <a href="/onboarding/interests">Interests</a>
          </Button>
        </nav>
      </div>

      <DashboardClient />
    </PageSurface>
  );
}
