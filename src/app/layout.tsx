import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { Geist, Geist_Mono } from "next/font/google";

import { authOptions } from "@/auth.config";
import { HeaderAuth } from "@/components/header-auth";
import { Providers } from "@/components/providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Next Action Decision Assistant",
  description:
    "A calm, focused assistant to help you pick the next best thing to work on.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getServerSession(authOptions);

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <Providers session={session}>
          <div className="min-h-screen flex flex-col">
            {/*
              Header band: a soft Light Blue tint (--header, ~45% over
              white), not the full-strength hex — full-strength Light Blue
              directly above the green tiers below read as two unrelated
              apps stacked together. This tint still gives Ebony text 4.7:1,
              comfortably above the 3:1 "large text" minimum the wordmark's
              size/weight qualifies for (see docs/Design-System.md — nothing
              in this palette gets Ebony to 4.5:1 on Light Blue at any
              strength, so the header stays large/bold text only; every
              other header element carries its own opaque background).
            */}
            <header className="border-b border-foreground/15 bg-header backdrop-blur">
              <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
                <div className="text-xl font-bold tracking-tight text-foreground">
                  Next Action
                </div>
                <HeaderAuth session={session} />
              </div>
            </header>
            <main className="flex-1">{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
