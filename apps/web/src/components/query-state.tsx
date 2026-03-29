type QueryStateProps = {
  isLoading: boolean;
  error: string | null;
  lastUpdatedAt: string | null;
};

export function QueryState({ isLoading, error, lastUpdatedAt }: QueryStateProps) {
  if (error) {
    return <p className="rounded-lg border border-rose-300/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">{error}</p>;
  }
  return (
    <p className="text-xs text-slate-400">
      {isLoading ? "Syncing..." : "Synced"} {lastUpdatedAt ? `• ${new Date(lastUpdatedAt).toLocaleTimeString()}` : ""}
    </p>
  );
}

