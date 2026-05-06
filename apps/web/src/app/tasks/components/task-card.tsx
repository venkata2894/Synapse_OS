"use client";

import * as React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { BoardCard } from "@sentientops/contracts";
import { GripVertical, Link2 } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/cn";

const PRIORITY_TONE: Record<
  BoardCard["priority"],
  "neutral" | "info" | "warn" | "danger"
> = {
  low: "neutral",
  medium: "info",
  high: "warn",
  critical: "danger",
};

function relativeAge(iso: string | null | undefined): string {
  if (!iso) return "—";
  const then = new Date(iso).valueOf();
  if (Number.isNaN(then)) return "—";
  const ms = Date.now() - then;
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function initialOf(value: string | null | undefined): string {
  if (!value) return "?";
  const trimmed = value.trim();
  if (!trimmed) return "?";
  return trimmed.slice(0, 1).toUpperCase();
}

export interface TaskCardProps {
  card: BoardCard;
  isSelected: boolean;
  isOpen: boolean;
  isMultiSelected: boolean;
  isInvalidDropContext?: boolean;
  onClick: (event: React.MouseEvent<HTMLDivElement>) => void;
  onToggleSelect: (cardId: string, event: React.MouseEvent | React.ChangeEvent) => void;
}

/**
 * Sortable Kanban card used inside a lane's SortableContext.
 *
 * - The whole card is the drag handle except for explicit interactive zones
 *   (checkbox, click-to-open).
 * - No inline status pill — column position is the status (spec §7.3).
 */
export function TaskCard({
  card,
  isSelected,
  isOpen,
  isMultiSelected,
  isInvalidDropContext = false,
  onClick,
  onToggleSelect,
}: TaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: card.id,
    data: { type: "task", card },
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative cursor-pointer rounded-xl border bg-canvas-base px-3 py-3 text-left transition-all duration-150",
        "hover:border-edge-bright",
        isOpen
          ? "border-signal/50 shadow-[0_0_0_1px_rgba(34,211,238,0.25)]"
          : isMultiSelected
          ? "border-accent/50 bg-accent-dim/30"
          : "border-edge",
        isInvalidDropContext ? "opacity-50" : "",
        isDragging ? "ring-1 ring-signal/40" : ""
      )}
      onClick={onClick}
      role="button"
      tabIndex={0}
    >
      {/* drag handle (hover-revealed) */}
      <div
        {...attributes}
        {...listeners}
        className={cn(
          "absolute right-2 top-2 flex h-6 w-6 cursor-grab items-center justify-center rounded-md text-ink-ghost opacity-0 transition-opacity",
          "group-hover:opacity-100 active:cursor-grabbing"
        )}
        onClick={(event) => event.stopPropagation()}
        title="Drag to move · J/K"
        aria-label="Drag handle"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </div>

      {/* selection checkbox (hover or selected) */}
      <div
        className={cn(
          "absolute left-2 top-2 transition-opacity",
          isMultiSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        )}
        onClick={(event) => event.stopPropagation()}
      >
        <Checkbox
          checked={isMultiSelected}
          onCheckedChange={() => undefined}
          onClick={(event) => onToggleSelect(card.id, event)}
          aria-label={`Select ${card.title}`}
        />
      </div>

      <p
        className={cn(
          "pr-6 pl-6 text-sm font-medium leading-snug text-ink",
          "line-clamp-2"
        )}
      >
        {card.title}
      </p>

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5 pl-6">
        <Avatar className="h-5 w-5">
          <AvatarFallback className="text-[10px] font-semibold">
            {initialOf(card.assigned_to)}
          </AvatarFallback>
        </Avatar>
        <span className="font-mono text-[10px] text-ink-tertiary">
          {card.assigned_to ?? "unassigned"}
        </span>
        <Badge tone={PRIORITY_TONE[card.priority]}>{card.priority}</Badge>
        <span className="font-mono text-[10px] text-ink-ghost">
          {relativeAge(card.updated_at)}
        </span>
        {card.dependency_count > 0 ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-edge bg-canvas-deep px-1.5 py-0.5 font-mono text-[9px] text-ink-ghost">
            <Link2 className="h-2.5 w-2.5" />
            {card.dependency_count}
          </span>
        ) : null}
        {card.blocker_reason ? (
          <Badge tone="danger">blocked</Badge>
        ) : null}
      </div>

      {card.blocker_reason ? (
        <p className="mt-1.5 line-clamp-1 pl-6 text-[11px] text-danger">
          {card.blocker_reason}
        </p>
      ) : null}

      {/* keyboard hint (hover-only) */}
      <div className="pointer-events-none absolute bottom-1 right-2 hidden font-mono text-[9px] text-ink-ghost group-hover:block">
        J/K to move
      </div>

      {isSelected ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 w-0.5 rounded-l-xl bg-signal"
        />
      ) : null}
    </div>
  );
}
