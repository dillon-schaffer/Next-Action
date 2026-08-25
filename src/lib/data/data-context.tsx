"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useSession } from "next-auth/react";

import { hasUnmigratedGuestData } from "@/lib/guest/store";
import { migrateGuestDataToAccount } from "@/lib/guest/migrate";
import type { DataAdapter } from "./adapter";
import { createGuestAdapter } from "./guest-adapter";
import { createServerAdapter } from "./server-adapter";

interface DataContextValue {
  adapter: DataAdapter;
  mode: "guest" | "signed-in";
  /** false while next-auth is still resolving the session on first load. */
  isReady: boolean;
  showMigrationPrompt: boolean;
  dismissMigrationPrompt: () => void;
  runMigration: () => Promise<{ ok: boolean; error?: string }>;
}

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const [dismissed, setDismissed] = useState(false);
  const [migrated, setMigrated] = useState(false);

  const isReady = status !== "loading";
  const mode: "guest" | "signed-in" = status === "authenticated" ? "signed-in" : "guest";

  const guestAdapter = useMemo(() => createGuestAdapter(), []);
  const serverAdapter = useMemo(() => createServerAdapter(), []);
  const adapter = mode === "signed-in" ? serverAdapter : guestAdapter;

  // Only relevant once signed in: is there local guest data worth offering to sync?
  const showMigrationPrompt =
    isReady && mode === "signed-in" && !dismissed && !migrated && hasUnmigratedGuestData();

  const runMigration = useCallback(async () => {
    const result = await migrateGuestDataToAccount();
    if (result.ok) setMigrated(true);
    return result;
  }, []);

  const value: DataContextValue = {
    adapter,
    mode,
    isReady,
    showMigrationPrompt,
    dismissMigrationPrompt: () => setDismissed(true),
    runMigration,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useDataAdapter(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useDataAdapter must be used within a DataProvider");
  return ctx;
}
