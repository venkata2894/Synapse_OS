"use client";

import { useMemo, useState } from "react";

import { QueryState } from "@/components/query-state";
import { ScoreRadar } from "@/components/score-radar";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardSubtitle, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useActor } from "@/hooks/use-actor";
import { usePollingQuery } from "@/hooks/use-polling-query";
import { averageEvaluationScore, listAgents, listEvaluations } from "@/lib/api-client";
import { shortDate } from "@/lib/format";

type TimeRange = "24h" | "7d" | "30d" | "all";

const TIME_RANGE_OPTIONS: { value: TimeRange; label: string }[] = [
  { value: "24h", label: "Last 24h" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "all", label: "All time" },
];

const SELECT_CLASS =
  "h-10 rounded-xl border border-edge bg-canvas-inset px-3 text-sm text-ink outline-none focus:border-signal/50 focus:ring-2 focus:ring-signal/20";

function scoreTone(score: number): string {
  if (score >= 7) return "text-signal";
  if (score >= 4) return "text-warn";
  return "text-danger";
}

function timeRangeCutoffMs(range: TimeRange): number | null {
  const now = Date.now();
  switch (range) {
    case "24h":
      return now - 24 * 60 * 60 * 1000;
    case "7d":
      return now - 7 * 24 * 60 * 60 * 1000;
    case "30d":
      return now - 30 * 24 * 60 * 60 * 1000;
    case "all":
    default:
      return null;
  }
}

export default function EvaluationsPage() {
  const actor = useActor();
  const [agentFilter, setAgentFilter] = useState<string>("");
  const [timeRange, setTimeRange] = useState<TimeRange>("7d");
  const [scoreFloorInput, setScoreFloorInput] = useState<string>("");

  const scoreFloor = useMemo(() => {
    const parsed = Number.parseFloat(scoreFloorInput);
    if (Number.isFinite(parsed)) return Math.max(0, Math.min(10, parsed));
    return null;
  }, [scoreFloorInput]);

  const agentsQuery = usePollingQuery(
    () => listAgents({ actorId: actor.actorId, actorRole: actor.actorRole }),
    `agents:${actor.actorId}`,
    { enabled: actor.ready }
  );

  const evaluationsQuery = usePollingQuery(
    () =>
      listEvaluations(
        { actorId: actor.actorId, actorRole: actor.actorRole },
        { agentId: agentFilter || undefined }
      ),
    `evaluations:${actor.actorId}:${agentFilter || "_"}:${timeRange}:${scoreFloor ?? "_"}`,
    { enabled: actor.ready }
  );

  const agentNameById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const agent of agentsQuery.data?.items ?? []) {
      map[agent.id] = agent.name;
    }
    return map;
  }, [agentsQuery.data?.items]);

  const cards = useMemo(() => {
    const cutoff = timeRangeCutoffMs(timeRange);
    return (evaluationsQuery.data?.items ?? [])
      .map((evaluation) => ({
        ...evaluation,
        average: averageEvaluationScore(evaluation),
      }))
      .filter((card) => {
        if (cutoff !== null) {
          const ts = new Date(card.timestamp).getTime();
          if (Number.isFinite(ts) && ts < cutoff) return false;
        }
        if (scoreFloor !== null && card.average < scoreFloor) return false;
        return true;
      });
  }, [evaluationsQuery.data?.items, timeRange, scoreFloor]);

  const hasFilters = Boolean(agentFilter) || timeRange !== "7d" || scoreFloor !== null;

  function clearFilters(): void {
    setAgentFilter("");
    setTimeRange("7d");
    setScoreFloorInput("");
  }

  return (
    <section className="space-y-4">
      <Card>
        <CardHeader>
          <div>
            <CardSubtitle>Evaluator Layer</CardSubtitle>
            <CardTitle>Scorecards and Audit Visibility</CardTitle>
          </div>
          <QueryState
            isLoading={evaluationsQuery.isLoading}
            error={evaluationsQuery.error ?? agentsQuery.error}
            lastUpdatedAt={evaluationsQuery.lastUpdatedAt}
          />
        </CardHeader>

        <div className="flex flex-wrap items-end gap-3 border-t border-edge pt-4">
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-tertiary">Agent</span>
            <select
              value={agentFilter}
              onChange={(event) => setAgentFilter(event.target.value)}
              className={SELECT_CLASS}
            >
              <option value="">All agents</option>
              {(agentsQuery.data?.items ?? []).map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-tertiary">Time range</span>
            <select
              value={timeRange}
              onChange={(event) => setTimeRange(event.target.value as TimeRange)}
              className={SELECT_CLASS}
            >
              {TIME_RANGE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-tertiary">Score floor</span>
            <Input
              type="number"
              min={0}
              max={10}
              step={0.1}
              placeholder="0 – 10"
              value={scoreFloorInput}
              onChange={(event) => setScoreFloorInput(event.target.value)}
              className="w-32"
            />
          </label>

          <div className="ml-auto">
            <Button variant="outline" size="sm" onClick={clearFilters} disabled={!hasFilters}>
              Clear filters
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => {
          const radarScores = [
            { label: "Completion", value: card.score_completion },
            { label: "Quality", value: card.score_quality },
            { label: "Reliability", value: card.score_reliability },
            { label: "Handover", value: card.score_handover },
            { label: "Context", value: card.score_context },
            { label: "Clarity", value: card.score_clarity },
            { label: "Improvement", value: card.score_improvement },
          ];
          const agentName = agentNameById[card.agent_id] ?? card.agent_id;
          return (
            <Card key={card.id} className="transition-all duration-200 hover:border-edge-bright">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{agentName}</p>
                  <p className="truncate font-mono text-[10px] text-ink-ghost">Task {card.task_id}</p>
                </div>
                <p className="font-mono text-[10px] text-ink-tertiary">{shortDate(card.timestamp)}</p>
              </div>

              <div className="mt-3 flex items-center gap-3">
                <div className="shrink-0">
                  <ScoreRadar scores={radarScores} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-tertiary">Average</p>
                  <p className={`font-display text-4xl font-bold tabular-nums ${scoreTone(card.average)}`}>
                    {card.average.toFixed(1)}
                    <span className="ml-1 font-mono text-sm font-normal text-ink-ghost">/ 10</span>
                  </p>
                  <ul className="mt-2 space-y-0.5">
                    {radarScores.map((metric) => (
                      <li key={metric.label} className="flex items-center justify-between gap-2">
                        <span className="text-[11px] text-ink-tertiary">{metric.label}</span>
                        <span className={`font-mono text-[11px] tabular-nums ${scoreTone(metric.value)}`}>
                          {metric.value.toFixed(1)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </Card>
          );
        })}
        {!cards.length && !evaluationsQuery.isLoading ? (
          <p className="text-sm text-ink-tertiary md:col-span-2 xl:col-span-3">
            No evaluations match these filters.
          </p>
        ) : null}
      </div>
    </section>
  );
}
