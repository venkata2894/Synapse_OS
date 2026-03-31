"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type StreamStatus = "idle" | "connecting" | "connected" | "retrying";

type UseResilientEventStreamOptions = {
  enabled: boolean;
  connect: () => EventSource;
  onEvent: (event: MessageEvent<string>) => void;
  heartbeatTimeoutMs?: number;
  baseRetryMs?: number;
  maxRetryMs?: number;
};

export function useResilientEventStream(options: UseResilientEventStreamOptions) {
  const {
    enabled,
    connect,
    onEvent,
    heartbeatTimeoutMs = 35_000,
    baseRetryMs = 1_000,
    maxRetryMs = 30_000
  } = options;
  const [status, setStatus] = useState<StreamStatus>("idle");
  const [reconnectCount, setReconnectCount] = useState(0);
  const [lastEventAt, setLastEventAt] = useState<string | null>(null);

  const sourceRef = useRef<EventSource | null>(null);
  const statusRef = useRef<StreamStatus>("idle");
  const reconnectTimerRef = useRef<number | null>(null);
  const heartbeatWatchRef = useRef<number | null>(null);
  const retriesRef = useRef(0);
  const lastEventUnixRef = useRef(0);

  const clearSource = useCallback(() => {
    if (sourceRef.current) {
      sourceRef.current.onopen = null;
      sourceRef.current.onmessage = null;
      sourceRef.current.onerror = null;
      sourceRef.current.close();
      sourceRef.current = null;
    }
  }, []);

  const clearTimers = useCallback(() => {
    if (reconnectTimerRef.current) {
      window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (heartbeatWatchRef.current) {
      window.clearInterval(heartbeatWatchRef.current);
      heartbeatWatchRef.current = null;
    }
  }, []);

  const connectNow = useCallback(() => {
    if (!enabled) {
      return;
    }
    clearSource();
    const nextStatus = retriesRef.current > 0 ? "retrying" : "connecting";
    statusRef.current = nextStatus;
    setStatus(nextStatus);

    const stream = connect();
    sourceRef.current = stream;

    const markEvent = () => {
      const now = Date.now();
      lastEventUnixRef.current = now;
      setLastEventAt(new Date(now).toISOString());
    };

    stream.onopen = () => {
      retriesRef.current = 0;
      setReconnectCount(0);
      statusRef.current = "connected";
      setStatus("connected");
      markEvent();
    };

    stream.onmessage = (event) => {
      markEvent();
      onEvent(event);
    };

    stream.addEventListener("heartbeat", (event) => {
      const heartbeat = event as MessageEvent<string>;
      markEvent();
      onEvent(heartbeat);
    });

    stream.onerror = () => {
      clearSource();
      retriesRef.current += 1;
      setReconnectCount(retriesRef.current);
      statusRef.current = "retrying";
      setStatus("retrying");
      const jitter = Math.floor(Math.random() * 500);
      const backoff = Math.min(maxRetryMs, baseRetryMs * 2 ** (retriesRef.current - 1)) + jitter;
      reconnectTimerRef.current = window.setTimeout(() => {
        connectNow();
      }, backoff);
    };
  }, [baseRetryMs, clearSource, connect, enabled, maxRetryMs, onEvent]);

  const reconnect = useCallback(() => {
    retriesRef.current = 0;
    setReconnectCount(0);
    connectNow();
  }, [connectNow]);

  useEffect(() => {
    clearTimers();
    if (!enabled) {
      clearSource();
      statusRef.current = "idle";
      setStatus("idle");
      setReconnectCount(0);
      setLastEventAt(null);
      lastEventUnixRef.current = 0;
      return;
    }

    connectNow();
    heartbeatWatchRef.current = window.setInterval(() => {
      if (statusRef.current !== "connected") {
        return;
      }
      const stale = Date.now() - lastEventUnixRef.current > heartbeatTimeoutMs;
      if (stale) {
        clearSource();
        retriesRef.current += 1;
        setReconnectCount(retriesRef.current);
        statusRef.current = "retrying";
        setStatus("retrying");
        reconnectTimerRef.current = window.setTimeout(() => {
          connectNow();
        }, baseRetryMs);
      }
    }, 5_000);

    return () => {
      clearTimers();
      clearSource();
    };
  }, [baseRetryMs, clearSource, clearTimers, connectNow, enabled, heartbeatTimeoutMs]);

  return useMemo(
    () => ({
      status,
      reconnectCount,
      lastEventAt,
      reconnect
    }),
    [lastEventAt, reconnect, reconnectCount, status]
  );
}
