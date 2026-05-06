"use client";

import { useEffect } from "react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Route error", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
      <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-ink-tertiary">
        Something went wrong
      </p>
      <h1 className="font-display text-2xl font-bold text-ink">
        This view failed to load
      </h1>
      <p className="max-w-md text-sm text-ink-secondary">
        {error.message || "An unexpected error occurred while rendering this page."}
      </p>
      <button
        onClick={reset}
        className="rounded-xl bg-signal px-4 py-2 text-sm font-semibold text-white transition hover:bg-signal/90"
      >
        Try again
      </button>
    </div>
  );
}
