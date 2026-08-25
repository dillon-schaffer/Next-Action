"use client";

import { SessionProvider } from "next-auth/react";
import type { Session } from "next-auth";

import { DataProvider } from "@/lib/data/data-context";

/**
 * Wraps the app with next-auth's client session context and the guest/
 * signed-in data adapter context. `session` is the server-fetched initial
 * value so there's no auth flash on first paint for already-signed-in users;
 * guests simply see status "unauthenticated" and use local storage.
 */
export function Providers({
  session,
  children,
}: {
  session: Session | null;
  children: React.ReactNode;
}) {
  return (
    <SessionProvider session={session}>
      <DataProvider>{children}</DataProvider>
    </SessionProvider>
  );
}
