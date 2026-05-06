"use client";

import * as React from "react";
import { Plus, Search } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { useActor } from "@/hooks/use-actor";
import { cn } from "@/lib/cn";
import { createProject } from "@/lib/api-client";

import type { ProjectContract } from "@sentientops/contracts";

const PULSE_WINDOW_MS = 60_000;

function initials(name: string | null | undefined): string {
  if (!name) return "??";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "??";
}

export type ProjectRailItem = {
  project: ProjectContract;
  managerName: string | null;
  wipCount: number | null;
};

type ProjectRailProps = {
  items: ProjectRailItem[];
  selectedProjectId: string | null;
  onSelect: (projectId: string) => void;
  pulseMap: Map<string, number>;
  onProjectCreated: (project: ProjectContract) => void;
};

export function ProjectRail({
  items,
  selectedProjectId,
  onSelect,
  pulseMap,
  onProjectCreated,
}: ProjectRailProps) {
  const [search, setSearch] = React.useState("");
  const [createOpen, setCreateOpen] = React.useState(false);
  const [now, setNow] = React.useState(() => Date.now());

  // Refresh pulse-dot visibility once per ~10s so dots fade out without an SSE event.
  React.useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 10_000);
    return () => window.clearInterval(timer);
  }, []);

  const filtered = React.useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return items;
    return items.filter(({ project, managerName }) => {
      return (
        project.name.toLowerCase().includes(term) ||
        (managerName ?? "").toLowerCase().includes(term)
      );
    });
  }, [items, search]);

  return (
    <aside className="surface flex h-fit max-h-[calc(100vh-7rem)] flex-col overflow-hidden p-0 lg:sticky lg:top-6">
      <div className="border-b border-edge p-3">
        <p className="px-1 pb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-tertiary">
          Projects
        </p>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-ghost" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search projects"
            className="h-9 pl-8 text-sm"
          />
        </div>
      </div>

      <ScrollArea className="flex-1 min-h-[280px]">
        <div className="space-y-1 p-2">
          {filtered.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-ink-tertiary">
              {items.length === 0 ? "No projects yet." : "No matches."}
            </p>
          ) : (
            filtered.map(({ project, managerName, wipCount }) => {
              const isSelected = project.id === selectedProjectId;
              const lastEventAt = pulseMap.get(project.id) ?? 0;
              const pulsing = lastEventAt > 0 && now - lastEventAt < PULSE_WINDOW_MS;
              return (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => onSelect(project.id)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition",
                    isSelected
                      ? "bg-signal-dim ring-1 ring-signal/40"
                      : "hover:bg-canvas-raised"
                  )}
                >
                  <Avatar className="h-7 w-7 shrink-0">
                    <AvatarFallback className="text-[10px] font-bold">
                      {initials(managerName ?? project.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "truncate text-sm font-semibold",
                        isSelected ? "text-signal" : "text-ink"
                      )}
                    >
                      {project.name}
                    </p>
                    <p className="truncate font-mono text-[10px] text-ink-tertiary">
                      {managerName ?? "no manager"}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {typeof wipCount === "number" ? (
                      <span className="rounded-full bg-canvas-raised px-1.5 py-0.5 font-mono text-[9px] text-ink-secondary">
                        {wipCount}
                      </span>
                    ) : null}
                    {pulsing ? (
                      <span
                        aria-label="Recent activity"
                        title="Activity in the last minute"
                        className="live-dot"
                      />
                    ) : (
                      <span className="h-2 w-2" />
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </ScrollArea>

      <div className="border-t border-edge p-3">
        <Button
          size="sm"
          variant="secondary"
          className="w-full"
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="h-4 w-4" /> New project
        </Button>
      </div>

      <CreateProjectDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(project) => {
          onProjectCreated(project);
          setCreateOpen(false);
        }}
      />
    </aside>
  );
}

function CreateProjectDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (project: ProjectContract) => void;
}) {
  const actor = useActor();
  const [name, setName] = React.useState("");
  const [objective, setObjective] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function reset() {
    setName("");
    setObjective("");
    setDescription("");
    setError(null);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const project = await createProject(
        { actorId: actor.actorId, actorRole: actor.actorRole },
        {
          name: name.trim(),
          objective: objective.trim() || undefined,
          description: description.trim() || undefined,
          owner: actor.actorId || "owner-dev",
        }
      );
      reset();
      onCreated(project);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New project</DialogTitle>
          <DialogDescription>
            Spin up a new project workspace. You can assign a manager and agents next.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={handleSubmit}>
          <Field label="Name" required>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Atlas migration"
              autoFocus
              required
            />
          </Field>
          <Field label="Objective">
            <Input
              value={objective}
              onChange={(event) => setObjective(event.target.value)}
              placeholder="What outcome defines success?"
            />
          </Field>
          <Field label="Description">
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Short context for the team."
            />
          </Field>

          {error ? (
            <p className="rounded-lg border border-danger/30 bg-danger-dim px-3 py-2 text-sm text-danger">
              {error}
            </p>
          ) : null}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" size="sm">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" size="sm" disabled={submitting}>
              {submitting ? "Creating..." : "Create project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-tertiary">
        {label}
        {required ? <span className="text-danger">*</span> : null}
      </span>
      {children}
    </label>
  );
}
