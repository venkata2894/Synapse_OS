"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type UsePollingQueryOptions<T> = {
  enabled?: boolean;
  intervalMs?: number;
  initialData?: T | null;
};

export function usePollingQuery<T>(
  fetcher: () => Promise<T>,
  queryKey: string,
  options: UsePollingQueryOptions<T> = {}
) {
  const { enabled = true, intervalMs = 10_000, initialData = null } = options;
  const [data, setData] = useState<T | null>(initialData);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(enabled));
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const hasFetchedRef = useRef(false);

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const run = useCallback(async () => {
    if (!enabled) return;
    if (!hasFetchedRef.current) setIsLoading(true);
    try {
      const next = await fetcherRef.current();
      setData(next);
      setError(null);
      setLastUpdatedAt(new Date().toISOString());
      hasFetchedRef.current = true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setIsLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void run();
  }, [run, queryKey]);

  useEffect(() => {
    if (!enabled) return;
    const timer = window.setInterval(() => {
      void run();
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [enabled, intervalMs, run]);

  return useMemo(
    () => ({ data, error, isLoading, lastUpdatedAt, refresh: run }),
    [data, error, isLoading, lastUpdatedAt, run]
  );
}
