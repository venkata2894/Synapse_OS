import Link from "next/link";

export const dynamic = "force-dynamic";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
      <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-ink-tertiary">
        404
      </p>
      <h1 className="font-display text-2xl font-bold text-ink">
        Route not found
      </h1>
      <p className="max-w-md text-sm text-ink-secondary">
        The path you tried to open does not exist in this build.
      </p>
      <Link
        href="/"
        className="rounded-xl bg-signal px-4 py-2 text-sm font-semibold text-white transition hover:bg-signal/90"
      >
        Back to dashboard
      </Link>
    </div>
  );
}
