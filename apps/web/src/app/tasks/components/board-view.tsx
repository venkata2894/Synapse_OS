"use client";

import * as React from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCorners,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import type { BoardCard, BoardLane, BoardSnapshot, TaskStatus } from "@sentientops/contracts";

import { TooltipProvider } from "@/components/ui/tooltip";
import { TASK_STATUS_LABELS } from "@/lib/status";
import { ALL_GROUP_LANES, STAGE_GROUPS } from "./stages";
import { StageGroupView } from "./stage-group";
import { TaskCard } from "./task-card";

export interface BoardViewProps {
  board: BoardSnapshot;
  selectedIds: Set<string>;
  openTaskId: string | null;
  isTransitionAllowed: (from: TaskStatus, to: TaskStatus) => boolean;
  onTransition: (cardId: string, toStatus: TaskStatus) => Promise<void> | void;
  onCardClick: (
    cardId: string,
    event: React.MouseEvent<HTMLDivElement>
  ) => void;
  onToggleSelect: (
    cardId: string,
    event: React.MouseEvent | React.ChangeEvent
  ) => void;
}

/**
 * Kanban board wrapping the 4 stage groups in one DndContext. Each lane has
 * its own SortableContext (declared inside StageGroupView). Drop targets
 * compute validity from `isTransitionAllowed`.
 */
export function BoardView({
  board,
  selectedIds,
  openTaskId,
  isTransitionAllowed,
  onTransition,
  onCardClick,
  onToggleSelect,
}: BoardViewProps): React.ReactElement {
  const [activeCard, setActiveCard] = React.useState<BoardCard | null>(null);
  const [collapsed, setCollapsed] = React.useState<Record<string, boolean>>(
    () =>
      Object.fromEntries(
        STAGE_GROUPS.map((group) => [group.key, group.defaultCollapsed ?? false])
      )
  );

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const lanesByStatus = React.useMemo(() => {
    const map: Record<string, BoardLane | undefined> = {};
    for (const lane of board.lanes) {
      if (typeof lane.status === "string") map[lane.status] = lane;
    }
    return map;
  }, [board.lanes]);

  const cardsByStatus = React.useMemo(() => {
    const map: Record<string, BoardCard[]> = {};
    for (const status of ALL_GROUP_LANES) map[status] = [];
    for (const lane of board.lanes) {
      const statusKey = String(lane.status);
      if (!map[statusKey]) map[statusKey] = [];
      map[statusKey] = lane.cards.slice();
    }
    return map;
  }, [board.lanes]);

  const handleDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current as { type?: string; card?: BoardCard } | undefined;
    if (data?.type === "task" && data.card) {
      setActiveCard(data.card);
    }
  };

  const handleDragCancel = () => setActiveCard(null);

  const handleDragEnd = async (event: DragEndEvent) => {
    const card = (event.active.data.current as { card?: BoardCard } | undefined)?.card;
    setActiveCard(null);
    if (!card || !event.over) return;
    const overData = event.over.data.current as
      | { type?: string; status?: TaskStatus; card?: BoardCard }
      | undefined;
    let targetStatus: TaskStatus | null = null;
    if (overData?.type === "lane" && overData.status) {
      targetStatus = overData.status;
    } else if (overData?.type === "task" && overData.card) {
      targetStatus = overData.card.status;
    }
    if (!targetStatus || targetStatus === card.status) return;
    if (!isTransitionAllowed(card.status, targetStatus)) return;
    await onTransition(card.id, targetStatus);
  };

  const isDropAllowedFor = React.useCallback(
    (toStatus: TaskStatus) => {
      if (!activeCard) return true;
      if (activeCard.status === toStatus) return true;
      return isTransitionAllowed(activeCard.status, toStatus);
    },
    [activeCard, isTransitionAllowed]
  );

  const invalidReasonFor = React.useCallback(
    (toStatus: TaskStatus): string | null => {
      if (!activeCard) return null;
      if (isDropAllowedFor(toStatus)) return null;
      return `${TASK_STATUS_LABELS[activeCard.status]} → ${TASK_STATUS_LABELS[toStatus]} is not a valid transition.`;
    },
    [activeCard, isDropAllowedFor]
  );

  const toggleGroup = (key: string) =>
    setCollapsed((current) => ({ ...current, [key]: !current[key] }));

  return (
    <TooltipProvider delayDuration={150}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="soft-scroll overflow-x-auto pb-3">
          <div className="flex min-w-max gap-6">
            {STAGE_GROUPS.map((group) => (
              <StageGroupView
                key={group.key}
                group={group}
                lanesByStatus={lanesByStatus}
                cardsByStatus={cardsByStatus}
                selectedIds={selectedIds}
                openTaskId={openTaskId}
                collapsed={Boolean(collapsed[group.key])}
                onToggleCollapsed={() => toggleGroup(group.key)}
                isDragActive={Boolean(activeCard)}
                isDropAllowed={isDropAllowedFor}
                invalidReasonFor={invalidReasonFor}
                onCardClick={onCardClick}
                onToggleSelect={onToggleSelect}
              />
            ))}
          </div>
        </div>

        <DragOverlay dropAnimation={null}>
          {activeCard ? (
            <div className="w-[280px] opacity-95">
              <TaskCard
                card={activeCard}
                isOpen={false}
                isSelected={false}
                isMultiSelected={false}
                onClick={() => undefined}
                onToggleSelect={() => undefined}
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </TooltipProvider>
  );
}
