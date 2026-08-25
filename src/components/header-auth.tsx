"use client";

import { signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";

export function HeaderAuth({
  session,
}: {
  session: { user?: { name?: string | null } } | null;
}) {
  const pathname = usePathname();

  if (session) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => signOut({ callbackUrl: "/" })}
      >
        Sign out
      </Button>
    );
  }

  return (
    <Button variant="outline" size="sm" asChild>
      <Link href={`/auth/sign-in?callbackUrl=${encodeURIComponent(pathname || "/dashboard")}`}>
        Save progress
      </Link>
    </Button>
  );
}
