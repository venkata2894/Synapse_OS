"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type UsePollingQueryOptions<T> = {
  enabled?: boolean;
  intervalMs?: number;
  initialData?: T | null;
};

export function usePollingQuery<T>(
  fetcher: () => Promise<T>,
  deps: unknown[],
  options: UsePollingQueryOptions<T> = {}
) {
  const { enabled = true, intervalMs = 10_000, initialData = null } = options;
  const [data, setData] = useState<T | null>(initialData);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(enabled));
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);

  const run = useCallback(async () => {
    if (!enabled) {
      return;
    }
    setIsLoading(true);
    try {
      const next = await fetcher();
      setData(next);
      setError(null);
      setLastUpdatedAt(new Date().toISOString());
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unexpected error";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [enabled, fetcher]);

  useEffect(() => {
    void run();
  }, [run, ...deps]);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const timer = window.setInterval(() => {
      void run();
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [enabled, intervalMs, run]);

  return useMemo(
    () => ({
      data,
      error,
      isLoading,
      lastUpdatedAt,
      refresh: run
    }),
    [data, error, isLoading, lastUpdatedAt, run]
  );
}

