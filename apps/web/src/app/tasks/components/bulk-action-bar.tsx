"use client";

import * as React from "react";
import type { TaskStatus } from "@sentientops/contracts";
import { Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { TASK_STATUS_LABELS } from "@/lib/status";

export interface BulkActionBarProps {
  selectedCount: number;
  validBulkTransitions: TaskStatus[];
  isMutating: boolean;
  onClear: () => void;
  onApply: (target: TaskStatus) => Promise<void> | void;
}

/**
 * Bottom action bar shown when one or more tasks are multi-selected.
 * Slides up from below and shows valid bulk transitions = intersection of
 * each selected task's allowed-next set.
 */
export function BulkActionBar({
  selectedCount,
  validBulkTransitions,
  isMutating,
  onClear,
  onApply,
}: BulkActionBarProps): React.ReactElement | null {
  if (selectedCount === 0) return null;

  return (
    <div
      className="fixed bottom-4 left-1/2 z-40 flex w-[min(720px,calc(100vw-2rem))] -translate-x-1/2 items-center gap-3 rounded-2xl border border-signal/30 bg-canvas-surface px-4 py-3 shadow-[0_8px_32px_rgba(0,0,0,0.45)] backdrop-blur"
      role="region"
      aria-label="Bulk actions"
    >
      <span className="font-mono text-xs text-ink-secondary">
        {selectedCount} selected
      </span>

      <span className="h-5 w-px bg-edge" />

      <div className="soft-scroll flex flex-1 items-center gap-1.5 overflow-x-auto">
        {validBulkTransitions.length === 0 ? (
          <span className="font-mono text-[11px] text-ink-ghost">
            No common transitions
          </span>
        ) : (
          validBulkTransitions.map((status) => (
            <Button
              key={status}
              type="button"
              size="sm"
              variant="secondary"
              disabled={isMutating}
              onClick={() => void onApply(status)}
            >
              {isMutating ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : null}
              → {TASK_STATUS_LABELS[status]}
            </Button>
          ))
        )}
      </div>

      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={onClear}
        aria-label="Clear selection"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
