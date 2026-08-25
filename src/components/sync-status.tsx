"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useDataAdapter } from "@/lib/data/data-context";

/** Small, low-pressure indicator of where progress currently lives. */
export function SyncStatus() {
  const { mode, isReady } = useDataAdapter();
  const pathname = usePathname();

  if (!isReady) return null;

  if (mode === "signed-in") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-[var(--radius-lg)] border border-foreground/20 bg-frosted-mint px-3 py-1 text-xs font-medium text-foreground">
        <span className="size-1.5 rounded-full bg-primary" aria-hidden />
        Synced to your account
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2 rounded-[var(--radius-lg)] border border-foreground/20 bg-frosted-mint px-3 py-1 text-xs font-medium text-foreground">
      <span className="inline-flex items-center gap-1.5">
        <span className="size-1.5 rounded-full bg-light-blue" aria-hidden />
        Saved on this device
      </span>
      <Link
        href={`/auth/sign-in?callbackUrl=${encodeURIComponent(pathname || "/dashboard")}`}
        className="font-medium text-foreground underline underline-offset-2 hover:no-underline"
      >
        Save progress
      </Link>
    </span>
  );
}
