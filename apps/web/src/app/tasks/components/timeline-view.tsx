"use client";

import * as React from "react";
import type { TaskContract } from "@sentientops/contracts";

import { cn } from "@/lib/cn";

const STATUS_BAR_COLOR: Record<string, string> = {
  intake: "fill-purple-500/60",
  backlog: "fill-slate-500/60",
  ready: "fill-cyan-500/60",
  assigned: "fill-cyan-400/60",
  in_progress: "fill-signal/70",
  awaiting_handover: "fill-indigo-400/60",
  under_review: "fill-warn/70",
  evaluation: "fill-fuchsia-400/60",
  blocked: "fill-danger/70",
  completed: "fill-ok/70",
  reopened: "fill-orange-400/70",
};

interface TimelineViewProps {
  tasks: TaskContract[];
  onOpenTask: (taskId: string) => void;
}

function parseDate(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const value = new Date(iso).valueOf();
  if (Number.isNaN(value)) return null;
  return value;
}

const ROW_HEIGHT = 28;
const ROW_GAP = 6;
const LEFT_GUTTER = 220;
const RIGHT_PAD = 40;
const HEADER_HEIGHT = 28;

/**
 * Lightweight Gantt-ish strip drawn with SVG (no chart library).
 * Each row spans `created_at` → `completed_at|now`.
 */
export function TimelineView({
  tasks,
  onOpenTask,
}: TimelineViewProps): React.ReactElement {
  const now = Date.now();

  const items = React.useMemo(() => {
    const out = tasks
      .map((task) => {
        const start = parseDate(task.created_at);
        if (start === null) return null;
        // best-available "completed at" — fall back to updated_at when status === completed.
        const end =
          task.status === "completed"
            ? parseDate(task.updated_at) ?? now
            : now;
        return { task, start, end: Math.max(start + 60_000, end) };
      })
      .filter((item): item is { task: TaskContract; start: number; end: number } => Boolean(item));
    return out.sort((a, b) => a.start - b.start);
  }, [now, tasks]);

  const rangeStart = items.length ? items[0].start : now - 7 * 86_400_000;
  const rangeEnd = items.length
    ? Math.max(...items.map((item) => item.end))
    : now;
  const span = Math.max(1, rangeEnd - rangeStart);

  const [containerWidth, setContainerWidth] = React.useState(960);
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const update = () => setContainerWidth(node.clientWidth || 960);
    update();
    const resizeObserver = new ResizeObserver(update);
    resizeObserver.observe(node);
    return () => resizeObserver.disconnect();
  }, []);

  const chartWidth = Math.max(
    320,
    containerWidth - LEFT_GUTTER - RIGHT_PAD - 8 // padding from surface
  );
  const xFor = (ms: number): number =>
    LEFT_GUTTER + ((ms - rangeStart) / span) * chartWidth;

  const totalHeight =
    HEADER_HEIGHT +
    items.length * (ROW_HEIGHT + ROW_GAP) +
    ROW_GAP;

  // Date axis ticks — divide span into ~6 segments.
  const ticks = React.useMemo(() => {
    const count = 6;
    const out: { x: number; label: string }[] = [];
    for (let i = 0; i <= count; i++) {
      const ms = rangeStart + (span * i) / count;
      out.push({
        x: xFor(ms),
        label: new Date(ms).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        }),
      });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartWidth, rangeStart, span]);

  return (
    <div ref={containerRef} className="surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-tertiary">
          Lifespan timeline
        </p>
        <p className="font-mono text-[10px] text-ink-ghost">
          {items.length} task{items.length === 1 ? "" : "s"}
        </p>
      </div>

      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-edge bg-canvas-inset/40 px-4 py-10 text-center text-sm text-ink-ghost">
          No timeline data — no tasks for the selected project.
        </p>
      ) : (
        <div className="soft-scroll max-h-[70vh] overflow-y-auto">
          <svg
            width={LEFT_GUTTER + chartWidth + RIGHT_PAD}
            height={totalHeight}
            className="block"
          >
            {/* axis ticks */}
            {ticks.map((tick, idx) => (
              <g key={`tick-${idx}`}>
                <line
                  x1={tick.x}
                  x2={tick.x}
                  y1={HEADER_HEIGHT - 8}
                  y2={totalHeight - 4}
                  className="stroke-edge/30"
                  strokeDasharray="2 4"
                />
                <text
                  x={tick.x}
                  y={HEADER_HEIGHT - 12}
                  className="fill-[color:var(--ink-ghost,#6b7280)] font-mono"
                  fontSize={9}
                  textAnchor="middle"
                >
                  {tick.label}
                </text>
              </g>
            ))}

            {/* now line */}
            <line
              x1={xFor(now)}
              x2={xFor(now)}
              y1={HEADER_HEIGHT - 8}
              y2={totalHeight - 4}
              className="stroke-signal/60"
              strokeWidth={1}
            />

            {items.map((item, index) => {
              const y = HEADER_HEIGHT + index * (ROW_HEIGHT + ROW_GAP);
              const x1 = xFor(item.start);
              const x2 = xFor(item.end);
              const width = Math.max(2, x2 - x1);
              return (
                <g
                  key={item.task.id}
                  className="cursor-pointer"
                  onClick={() => onOpenTask(item.task.id)}
                >
                  <text
                    x={LEFT_GUTTER - 8}
                    y={y + ROW_HEIGHT / 2 + 3}
                    className="fill-[color:var(--ink-secondary,#cbd5e1)] font-mono"
                    fontSize={10}
                    textAnchor="end"
                  >
                    {item.task.title.length > 32
                      ? `${item.task.title.slice(0, 32)}…`
                      : item.task.title}
                  </text>
                  <rect
                    x={x1}
                    y={y + 4}
                    width={width}
                    height={ROW_HEIGHT - 8}
                    rx={4}
                    className={cn(
                      STATUS_BAR_COLOR[item.task.status] ?? "fill-edge",
                      "stroke-edge"
                    )}
                    strokeWidth={0.5}
                  />
                </g>
              );
            })}
          </svg>
        </div>
      )}
    </div>
  );
}
