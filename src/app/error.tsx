"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isConfigError =
    error.message?.includes("DATABASE_URL") ||
    error.message?.includes("not configured") ||
    error.message?.includes("environment");

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4">
      <main className="mx-auto max-w-xl space-y-4 rounded-[var(--radius-lg)] border bg-card p-8">
        <h1 className="text-h1">Something went wrong</h1>
        <p className="text-body text-muted-foreground">
          {isConfigError
            ? "This app is missing required configuration. If you run this site, check your environment variables (see .env.example)."
            : "We couldn’t complete your request. Please try again."}
        </p>
        <div className="flex gap-2">
          <Button onClick={reset} variant="default">
            Try again
          </Button>
          <Button asChild variant="outline">
            <Link href="/">Go home</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
