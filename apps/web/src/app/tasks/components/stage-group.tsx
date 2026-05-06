"use client";

import * as React from "react";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import type { BoardLane, BoardCard, TaskStatus } from "@sentientops/contracts";
import { ChevronDown } from "lucide-react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";
import { TASK_STATUS_LABELS } from "@/lib/status";
import type { StageGroup } from "./stages";
import { TaskCard } from "./task-card";

interface LaneViewProps {
  status: TaskStatus;
  lane: BoardLane | null;
  cards: BoardCard[];
  selectedIds: Set<string>;
  openTaskId: string | null;
  isDropAllowed: boolean;
  isDragActive: boolean;
  invalidReason: string | null;
  onCardClick: (
    cardId: string,
    event: React.MouseEvent<HTMLDivElement>
  ) => void;
  onToggleSelect: (
    cardId: string,
    event: React.MouseEvent | React.ChangeEvent
  ) => void;
}

function Lane({
  status,
  lane,
  cards,
  selectedIds,
  openTaskId,
  isDropAllowed,
  isDragActive,
  invalidReason,
  onCardClick,
  onToggleSelect,
}: LaneViewProps): React.ReactElement {
  const { isOver, setNodeRef } = useDroppable({
    id: `lane:${status}`,
    data: { type: "lane", status },
  });

  const wipLimit = lane?.wip_limit ?? 0;
  const wipExceeded = wipLimit > 0 && cards.length > wipLimit;
  const isInvalidHover = isOver && !isDropAllowed;

  const inner = (
    <article
      ref={setNodeRef}
      data-lane={status}
      className={cn(
        "flex w-[280px] shrink-0 flex-col rounded-xl border bg-canvas-inset/40 p-3 transition-all duration-150",
        wipExceeded ? "border-warn/40" : "border-edge",
        isOver && isDropAllowed
          ? "border-signal/60 shadow-[0_0_0_1px_rgba(34,211,238,0.4)]"
          : "",
        isInvalidHover ? "border-danger/60 opacity-90" : "",
        isDragActive && !isDropAllowed ? "opacity-60" : ""
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-tertiary">
            {TASK_STATUS_LABELS[status]}
          </p>
          {wipLimit ? (
            <p className="mt-0.5 font-mono text-[9px] text-ink-ghost">
              WIP {cards.length}/{wipLimit}
            </p>
          ) : (
            <p className="mt-0.5 font-mono text-[9px] text-ink-ghost">
              {cards.length} card{cards.length === 1 ? "" : "s"}
            </p>
          )}
        </div>
        <span
          className={cn(
            "rounded-full border px-2 py-0.5 font-mono text-[10px]",
            wipExceeded
              ? "border-warn/30 bg-warn-dim text-warn"
              : "border-edge bg-canvas-base text-ink-secondary"
          )}
        >
          {cards.length}
        </span>
      </div>

      {wipLimit ? (
        <div className="mt-2 h-1 rounded-full bg-edge/40">
          <div
            className={cn(
              "h-1 rounded-full transition-all",
              wipExceeded ? "bg-warn" : "bg-signal/60"
            )}
            style={{
              width: `${Math.min(
                100,
                Math.round((cards.length / Math.max(1, wipLimit)) * 100)
              )}%`,
            }}
          />
        </div>
      ) : null}

      <SortableContext
        items={cards.map((card) => card.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="soft-scroll mt-3 flex flex-1 flex-col gap-2 overflow-y-auto pr-0.5 min-h-[80px]">
          {cards.map((card) => (
            <TaskCard
              key={card.id}
              card={card}
              isOpen={openTaskId === card.id}
              isSelected={openTaskId === card.id}
              isMultiSelected={selectedIds.has(card.id)}
              onClick={(event) => onCardClick(card.id, event)}
              onToggleSelect={onToggleSelect}
            />
          ))}
          {cards.length === 0 ? (
            <p className="rounded-lg border border-dashed border-edge bg-canvas-base/40 px-3 py-4 text-center font-mono text-[10px] text-ink-ghost">
              {isDragActive && isDropAllowed ? "Drop here" : "No cards"}
            </p>
          ) : null}
        </div>
      </SortableContext>
    </article>
  );

  if (isInvalidHover && invalidReason) {
    return (
      <Tooltip open>
        <TooltipTrigger asChild>
          <div className="contents">{inner}</div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[260px] text-center">
          {invalidReason}
        </TooltipContent>
      </Tooltip>
    );
  }
  return inner;
}

export interface StageGroupViewProps {
  group: StageGroup;
  lanesByStatus: Record<string, BoardLane | undefined>;
  cardsByStatus: Record<string, BoardCard[]>;
  selectedIds: Set<string>;
  openTaskId: string | null;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  isDragActive: boolean;
  isDropAllowed: (toStatus: TaskStatus) => boolean;
  invalidReasonFor: (toStatus: TaskStatus) => string | null;
  onCardClick: (
    cardId: string,
    event: React.MouseEvent<HTMLDivElement>
  ) => void;
  onToggleSelect: (
    cardId: string,
    event: React.MouseEvent | React.ChangeEvent
  ) => void;
}

/** Render one stage caption above its 1+ lanes. */
export function StageGroupView({
  group,
  lanesByStatus,
  cardsByStatus,
  selectedIds,
  openTaskId,
  collapsed,
  onToggleCollapsed,
  isDragActive,
  isDropAllowed,
  invalidReasonFor,
  onCardClick,
  onToggleSelect,
}: StageGroupViewProps): React.ReactElement {
  const total = group.lanes.reduce(
    (sum, status) => sum + (cardsByStatus[status]?.length ?? 0),
    0
  );

  return (
    <section className="flex flex-col gap-2">
      <button
        type="button"
        onClick={onToggleCollapsed}
        className="flex w-fit items-center gap-2 self-start rounded-md px-2 py-1 text-left transition-colors hover:bg-canvas-raised/50"
      >
        <ChevronDown
          className={cn(
            "h-3 w-3 text-ink-tertiary transition-transform",
            collapsed ? "-rotate-90" : ""
          )}
        />
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-secondary">
          {group.label}
        </span>
        <span className="font-mono text-[10px] text-ink-ghost">· {total}</span>
      </button>

      {collapsed ? null : (
        <div className="flex gap-3">
          {group.lanes.map((status) => (
            <Lane
              key={status}
              status={status}
              lane={lanesByStatus[status] ?? null}
              cards={cardsByStatus[status] ?? []}
              selectedIds={selectedIds}
              openTaskId={openTaskId}
              isDropAllowed={isDropAllowed(status)}
              invalidReason={invalidReasonFor(status)}
              isDragActive={isDragActive}
              onCardClick={onCardClick}
              onToggleSelect={onToggleSelect}
            />
          ))}
        </div>
      )}
    </section>
  );
}
