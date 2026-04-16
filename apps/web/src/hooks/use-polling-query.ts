"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
  const hasFetchedRef = useRef(false);

  // Keep fetcher in a ref so `run` doesn't depend on it —
  // prevents the infinite re-render loop caused by inline arrow functions.
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const run = useCallback(async () => {
    if (!enabled) {
      return;
    }
    // Only show loading spinner on initial fetch, not on background polls.
    if (!hasFetchedRef.current) {
      setIsLoading(true);
    }
    try {
      const next = await fetcherRef.current();
      setData(next);
      setError(null);
      setLastUpdatedAt(new Date().toISOString());
      hasFetchedRef.current = true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unexpected error";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [enabled]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
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

