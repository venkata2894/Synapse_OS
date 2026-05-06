"use client";

import * as React from "react";
import {
  AlertTriangle,
  ArrowLeftRight,
  CheckCircle2,
  CircleAlert,
  Flag,
  GitMerge,
  Lightbulb,
  Loader,
  PlayCircle,
} from "lucide-react";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WorklogComposer } from "@/components/worklog-composer";
import type { StreamStatus } from "@/hooks/use-resilient-event-stream";
import { useActor } from "@/hooks/use-actor";
import { appendWorklog } from "@/lib/api-client";
import { cn } from "@/lib/cn";

import type {
  ProjectStaffingAgent,
  TaskContract,
  WorklogEntry,
} from "@sentientops/contracts";

import { HandoversTab } from "./handovers-tab";
import { HealthTab } from "./health-tab";

function ActionIcon({ action }: { action: string }) {
  const lower = action.toLowerCase();
  switch (lower) {
    case "progress":
      return <PlayCircle className="h-3.5 w-3.5 text-signal" />;
    case "decision":
      return <Lightbulb className="h-3.5 w-3.5 text-info" />;
    case "issue":
      return <AlertTriangle className="h-3.5 w-3.5 text-warn" />;
    case "output":
      return <CheckCircle2 className="h-3.5 w-3.5 text-signal" />;
    case "handover":
      return <ArrowLeftRight className="h-3.5 w-3.5 text-accent" />;
    case "completion":
      return <CheckCircle2 className="h-3.5 w-3.5 text-signal" />;
    case "correction":
      return <CircleAlert className="h-3.5 w-3.5 text-warn" />;
    case "start":
      return <Flag className="h-3.5 w-3.5 text-info" />;
    default:
      return <GitMerge className="h-3.5 w-3.5 text-ink-secondary" />;
  }
}

function shortDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

type RightRailProps = {
  projectId: string | null;
  worklogs: WorklogEntry[];
  worklogsLoading: boolean;
  tasks: TaskContract[];
  agents: ProjectStaffingAgent[];
  streamStatus: StreamStatus;
  reconnectCount: number;
  lastPollAt: string | null;
  onWorklogAppended: () => Promise<void> | void;
  refreshSignal: number;
  className?: string;
};

export function RightRail({
  projectId,
  worklogs,
  worklogsLoading,
  tasks,
  agents,
  streamStatus,
  reconnectCount,
  lastPollAt,
  onWorklogAppended,
  refreshSignal,
  className,
}: RightRailProps) {
  const actor = useActor();

  const disabledReasonForLog = React.useMemo(() => {
    if (!projectId) return "Select a project before writing logs.";
    if (!tasks.length) return "Create or load a task before writing logs.";
    if (!agents.length) return "Attach at least one agent first.";
    return null;
  }, [agents.length, projectId, tasks.length]);

  return (
    <aside
      className={cn(
        "surface flex flex-col overflow-hidden p-0 lg:sticky lg:top-6",
        className
      )}
    >
      <Tabs defaultValue="activity" className="flex flex-1 flex-col">
        <TabsList className="m-3 grid grid-cols-4">
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="quick-log">Quick log</TabsTrigger>
          <TabsTrigger value="handovers">Handovers</TabsTrigger>
          <TabsTrigger value="health">Health</TabsTrigger>
        </TabsList>

        <TabsContent value="activity" className="mt-0 flex-1">
          <ActivityFeed
            projectId={projectId}
            worklogs={worklogs}
            isLoading={worklogsLoading}
          />
        </TabsContent>

        <TabsContent value="quick-log" className="mt-0 px-4 pb-4">
          <WorklogComposer
            title="Quick log"
            tasks={tasks}
            agents={agents}
            disabledReason={disabledReasonForLog}
            submitLabel="Append"
            onSubmit={async (payload) => {
              await appendWorklog(
                { actorId: actor.actorId, actorRole: actor.actorRole },
                payload
              );
              await onWorklogAppended();
            }}
          />
        </TabsContent>

        <TabsContent value="handovers" className="mt-0">
          <HandoversTab
            projectId={projectId}
            tasks={tasks}
            agents={agents}
            refreshSignal={refreshSignal}
          />
        </TabsContent>

        <TabsContent value="health" className="mt-0">
          <HealthTab
            streamStatus={streamStatus}
            reconnectCount={reconnectCount}
            lastPollAt={lastPollAt}
          />
        </TabsContent>
      </Tabs>
    </aside>
  );
}

function ActivityFeed({
  projectId,
  worklogs,
  isLoading,
}: {
  projectId: string | null;
  worklogs: WorklogEntry[];
  isLoading: boolean;
}) {
  if (!projectId) {
    return (
      <p className="px-4 py-6 text-center text-sm text-ink-tertiary">
        Select a project to view activity.
      </p>
    );
  }
  if (isLoading && worklogs.length === 0) {
    return (
      <div className="flex items-center justify-center px-4 py-10 text-ink-tertiary">
        <Loader className="h-4 w-4 animate-spin" />
      </div>
    );
  }
  if (worklogs.length === 0) {
    return (
      <p className="px-4 py-6 text-center text-sm text-ink-tertiary">
        No worklogs yet. Start a quick log to seed the feed.
      </p>
    );
  }

  return (
    <ScrollArea className="max-h-[520px]">
      <div className="space-y-2 px-3 pb-3">
        {worklogs.map((entry) => (
          <div
            key={entry.id}
            className="rounded-lg border border-edge bg-canvas-inset p-3"
          >
            <div className="flex items-center gap-2">
              <ActionIcon action={entry.action_type} />
              <span className="font-mono text-[10px] uppercase tracking-wider text-ink-tertiary">
                {entry.action_type}
              </span>
              <span
                className="ml-auto font-mono text-[10px] text-ink-ghost"
                title={new Date(entry.timestamp).toLocaleString()}
              >
                {shortDate(entry.timestamp)}
              </span>
            </div>
            <p className="mt-1.5 text-sm leading-snug text-ink">{entry.summary}</p>
            <p className="mt-1 truncate font-mono text-[10px] text-ink-tertiary">
              {entry.agent_name} · {entry.task_title}
            </p>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
