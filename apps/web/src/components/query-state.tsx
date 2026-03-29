type QueryStateProps = {
  isLoading: boolean;
  error: string | null;
  lastUpdatedAt: string | null;
};

export function QueryState({ isLoading, error, lastUpdatedAt }: QueryStateProps) {
  if (error) {
    return <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>;
  }
  return (
    <p className="text-xs text-slate-500">
      {isLoading ? "Syncing..." : "Synced"} {lastUpdatedAt ? `| ${new Date(lastUpdatedAt).toLocaleTimeString()}` : ""}
    </p>
  );
}


