"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useDataAdapter } from "@/lib/data/data-context";

/**
 * Shown once, right after a guest signs in, when there's local data that
 * hasn't been synced yet. Retrying "Sync now" is safe — migration is
 * idempotent server-side (see /api/guest/migrate).
 */
export function MigrationBanner() {
  const { showMigrationPrompt, dismissMigrationPrompt, runMigration } = useDataAdapter();
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [succeeded, setSucceeded] = useState(false);

  if (!showMigrationPrompt && !succeeded) return null;

  async function handleSync() {
    setIsSyncing(true);
    setError(null);
    const result = await runMigration();
    setIsSyncing(false);
    if (result.ok) {
      setSucceeded(true);
    } else {
      setError(result.error ?? "Something went wrong. You can try again.");
    }
  }

  if (succeeded) {
    return (
      <Card className="border-l-4 border-l-foreground">
        <CardContent className="py-4 text-sm text-foreground">
          Synced. Your progress on this device is now saved to your account.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-l-4 border-l-foreground">
      <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          We found progress saved on this device. Sync it to your account so it follows you across devices?
        </p>
        <div className="flex shrink-0 gap-2">
          <Button size="sm" onClick={handleSync} disabled={isSyncing} loading={isSyncing}>
            {isSyncing ? "Syncing…" : "Sync now"}
          </Button>
          <Button size="sm" variant="ghost" onClick={dismissMigrationPrompt} disabled={isSyncing}>
            Not now
          </Button>
        </div>
        {error && <p className="text-sm text-destructive sm:basis-full">{error}</p>}
      </CardContent>
    </Card>
  );
}
