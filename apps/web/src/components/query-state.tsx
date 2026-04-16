type QueryStateProps = {
  isLoading: boolean;
  error: string | null;
  lastUpdatedAt: string | null;
};

export function QueryState({ isLoading, error, lastUpdatedAt }: QueryStateProps) {
  if (error) {
    return (
      <p className="rounded-lg border border-danger/30 bg-danger-dim px-3 py-2 text-sm text-danger">
        {error}
      </p>
    );
  }
  return (
    <p className="flex items-center gap-2 font-mono text-[10px] font-medium text-ink-tertiary">
      {isLoading ? (
        <>
          <span className="live-dot h-2 w-2" />
          <span className="text-signal">Synchronizing...</span>
        </>
      ) : (
        <>
          <span className="inline-block h-2 w-2 rounded-full bg-signal/40" />
          <span>Nodes Synced</span>
        </>
      )}
      {lastUpdatedAt ? (
        <span className="ml-1 rounded bg-slate-100 px-1.5 py-0.5 text-ink-ghost">
          {new Date(lastUpdatedAt).toLocaleTimeString()}
        </span>
      ) : (
        ""
      )}
    </p>
  );
}
