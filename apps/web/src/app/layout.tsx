import type { Metadata } from "next";
import { ClerkProvider, UserButton } from "@clerk/nextjs";
import { Bricolage_Grotesque, DM_Mono, DM_Sans } from "next/font/google";

import { ClerkActorProvider, LocalTesterActorProvider } from "@/components/actor-provider";
import { ShellWithPalette } from "@/components/shell-with-palette";

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
      <html lang="en" className="dark">
        <body className={`${display.variable} ${body.variable} ${mono.variable}`}>
          <LocalTesterActorProvider>
            <ShellWithPalette
              headerActions={
                <span className="flex items-center gap-2 rounded-full border border-signal/30 bg-signal-dim px-3 py-1 text-xs font-medium text-signal">
                  <span className="live-dot" />
                  Local Dev
                </span>
              }
            >
              {children}
            </ShellWithPalette>
          </LocalTesterActorProvider>
        </body>
      </html>
    );
  }

  return (
    <ClerkProvider publishableKey={publishableKey!}>
      <html lang="en" className="dark">
        <body className={`${display.variable} ${body.variable} ${mono.variable}`}>
          <ClerkActorProvider>
            <ShellWithPalette
              headerActions={
                <UserButton
                  appearance={{
                    variables: {
                      colorBackground: "var(--bg-surface)",
                      colorText: "var(--ink)",
                      colorPrimary: "var(--signal)",
                      colorInputBackground: "var(--bg-inset)",
                      colorInputText: "var(--ink)",
                    },
                    elements: { userButtonAvatarBox: "ring-2 ring-signal/40" },
                  }}
                />
              }
            >
              {children}
            </ShellWithPalette>
          </ClerkActorProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
