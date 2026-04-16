import type { Metadata } from "next";
import { ClerkProvider, UserButton } from "@clerk/nextjs";
import { Bricolage_Grotesque, DM_Mono, DM_Sans } from "next/font/google";

import { ClerkActorProvider, LocalTesterActorProvider } from "@/components/actor-provider";
import { AppShell } from "@/components/app-shell";

import "./globals.css";

const display = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-display" });
const body = DM_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-body" });
const mono = DM_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono" });

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
      <html lang="en" className="light">
        <body className={`${display.variable} ${body.variable} ${mono.variable}`}>
          <LocalTesterActorProvider>
            <AppShell
              headerActions={
                <span className="flex items-center gap-2 rounded-full border border-signal/30 bg-signal-dim px-3 py-1 text-xs font-medium text-signal">
                  <span className="live-dot" />
                  Local Dev
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
      <html lang="en" className="light">
        <body className={`${display.variable} ${body.variable} ${mono.variable}`}>
          <ClerkActorProvider>
            <AppShell
              headerActions={<UserButton appearance={{ elements: { userButtonAvatarBox: "ring-2 ring-edge-bright" } }} />}
            >
              {children}
            </AppShell>
          </ClerkActorProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
