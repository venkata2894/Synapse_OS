import type { Metadata } from "next";
import { ClerkProvider, UserButton } from "@clerk/nextjs";
import { IBM_Plex_Mono, Space_Grotesk } from "next/font/google";

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
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (!publishableKey) {
    throw new Error("Missing NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY. Strict Clerk auth is required.");
  }

  return (
    <ClerkProvider publishableKey={publishableKey}>
      <html lang="en">
        <body className={`${display.variable} ${mono.variable}`}>
          <AppShell
            headerActions={<UserButton appearance={{ elements: { userButtonAvatarBox: "ring-2 ring-slate-300/80" } }} />}
          >
            {children}
          </AppShell>
        </body>
      </html>
    </ClerkProvider>
  );
}
