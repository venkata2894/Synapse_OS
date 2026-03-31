import type { Metadata } from "next";
import { ClerkProvider, UserButton } from "@clerk/nextjs";
import { IBM_Plex_Mono, Space_Grotesk } from "next/font/google";

import { ClerkActorProvider, LocalTesterActorProvider } from "@/components/actor-provider";
import { AppShell } from "@/components/app-shell";

import "./globals.css";

const display = Space_Grotesk({ subsets: ["latin"], variable: "--font-display" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "SentientOps V1",
  description: "Operating layer for multi-agent project execution"
};

export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const localTesterAuth =
    process.env.SENTIENTOPS_TESTER_AUTH_MODE === "local_bypass" ||
    process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH === "true";
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (!localTesterAuth && !publishableKey) {
    throw new Error("Missing NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY. Strict Clerk auth is required.");
  }

  if (localTesterAuth) {
    return (
      <html lang="en">
        <body className={`${display.variable} ${mono.variable}`}>
          <LocalTesterActorProvider>
            <AppShell
              headerActions={
                <span className="rounded-full border border-sky-300/90 bg-sky-50 px-3 py-1 text-xs text-sky-700">
                  Local tester auth
                </span>
              }
            >
              {children}
            </AppShell>
          </LocalTesterActorProvider>
        </body>
      </html>
    );
  }

  return (
    <ClerkProvider publishableKey={publishableKey!}>
      <html lang="en">
        <body className={`${display.variable} ${mono.variable}`}>
          <ClerkActorProvider>
            <AppShell
              headerActions={<UserButton appearance={{ elements: { userButtonAvatarBox: "ring-2 ring-slate-300/80" } }} />}
            >
              {children}
            </AppShell>
          </ClerkActorProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
