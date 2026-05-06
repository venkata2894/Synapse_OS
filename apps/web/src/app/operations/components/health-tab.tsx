"use client";

import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { useActor } from "@/hooks/use-actor";
import { usePollingQuery } from "@/hooks/use-polling-query";
import { getIdempotencyHealth, getOutboxHealth } from "@/lib/api-client";

import type { StreamStatus } from "@/hooks/use-resilient-event-stream";

type HealthTabProps = {
  streamStatus: StreamStatus;
  reconnectCount: number;
  lastPollAt: string | null;
};

function formatPollAge(value: string | null): string {
  if (!value) return "—";
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return "—";
  const seconds = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  return `${hours}h ago`;
}

function streamTone(status: StreamStatus): "signal" | "warn" | "danger" | "neutral" {
  switch (status) {
    case "connected":
      return "signal";
    case "connecting":
      return "warn";
    case "retrying":
      return "danger";
    default:
      return "neutral";
  }
}

export function HealthTab({ streamStatus, reconnectCount, lastPollAt }: HealthTabProps) {
  const actor = useActor();

  const idempotencyQuery = usePollingQuery(
    () => getIdempotencyHealth({ actorId: actor.actorId, actorRole: actor.actorRole }),
    `health-idempotency:${actor.actorId}`,
    { enabled: actor.ready, intervalMs: 60_000 }
  );

  const outboxQuery = usePollingQuery(
    () => getOutboxHealth({ actorId: actor.actorId, actorRole: actor.actorRole }),
    `health-outbox:${actor.actorId}`,
    { enabled: actor.ready, intervalMs: 60_000 }
  );

  const [, force] = React.useReducer((x: number) => x + 1, 0);
  React.useEffect(() => {
    const timer = window.setInterval(force, 5_000);
    return () => window.clearInterval(timer);
  }, []);

  const idempotencySize =
    idempotencyQuery.data && typeof idempotencyQuery.data.size === "number"
      ? idempotencyQuery.data.size
      : null;

  const outboxDepth =
    outboxQuery.data && typeof outboxQuery.data.depth === "number"
      ? outboxQuery.data.depth
      : null;

  return (
    <div className="space-y-3 px-4 py-3">
      <Row label="SSE connection">
        <Badge tone={streamTone(streamStatus)}>{streamStatus}</Badge>
        {reconnectCount > 0 ? (
          <span className="font-mono text-[10px] text-ink-tertiary">
            {reconnectCount} reconnect{reconnectCount === 1 ? "" : "s"}
          </span>
        ) : null}
      </Row>
      <Row label="Last poll">
        <span className="font-mono text-xs text-ink">{formatPollAge(lastPollAt)}</span>
      </Row>
      <Row label="Idempotency cache">
        <span className="font-mono text-xs text-ink">
          {idempotencySize === null ? "—" : `${idempotencySize} keys`}
        </span>
      </Row>
      <Row label="Outbox depth">
        <span className="font-mono text-xs text-ink">
          {outboxDepth === null ? "—" : `${outboxDepth} pending`}
        </span>
      </Row>

      {idempotencySize === null && outboxDepth === null ? (
        <p className="pt-2 text-[11px] leading-relaxed text-ink-tertiary">
          Idempotency and outbox readouts depend on optional health endpoints
          (<code className="font-mono">/health/idempotency</code>,{" "}
          <code className="font-mono">/health/outbox</code>) that this API build does not
          expose. Other panels remain accurate.
        </p>
      ) : null}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-edge bg-canvas-inset px-3 py-2">
      <span className="font-mono text-[11px] uppercase tracking-wider text-ink-tertiary">
        {label}
      </span>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}
