import type { Metadata } from "next";
import { ClerkProvider, SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";
import { IBM_Plex_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";

const display = Space_Grotesk({ subsets: ["latin"], variable: "--font-display" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "SentientOps V1",
  description: "Operating layer for multi-agent project execution"
};

function AuthControls({ clerkEnabled }: { clerkEnabled: boolean }) {
  if (!clerkEnabled) {
    return <span className="text-xs text-slate-600">Auth not configured</span>;
  }
  return (
    <>
      <SignedOut>
        <SignInButton />
      </SignedOut>
      <SignedIn>
        <UserButton />
      </SignedIn>
    </>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const clerkEnabled = Boolean(publishableKey);
  const content = (
    <html lang="en">
      <body className={`${display.variable} ${mono.variable}`}>
        <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-slate-600">SentientOps V1</p>
            <h1 className="text-xl font-semibold text-ink">Control Room</h1>
          </div>
          <div className="flex items-center gap-3">
            <AuthControls clerkEnabled={clerkEnabled} />
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl px-6 pb-10">{children}</main>
      </body>
    </html>
  );

  if (!clerkEnabled) {
    return content;
  }
  return (
    <ClerkProvider publishableKey={publishableKey}>
      {content}
    </ClerkProvider>
  );
}
