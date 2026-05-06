"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { useActor } from "@/hooks/use-actor";
import { listProjects, listTasks, listAgents } from "@/lib/api-client";
import type { ProjectContract, TaskContract, AgentContract } from "@sentientops/contracts";

type RouteHit = { id: string; label: string; href: string };

const ROUTES: RouteHit[] = [
  { id: "dashboard", label: "Dashboard", href: "/" },
  { id: "projects", label: "Projects", href: "/projects" },
  { id: "operations", label: "Operations", href: "/operations" },
  { id: "tasks", label: "Tasks", href: "/tasks" },
  { id: "agents", label: "Agents", href: "/agents" },
  { id: "evaluations", label: "Evaluations", href: "/evaluations" },
  { id: "tools", label: "Tool Console", href: "/tools" },
];

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const router = useRouter();
  const actor = useActor();
  const [projects, setProjects] = React.useState<ProjectContract[]>([]);
  const [tasks, setTasks] = React.useState<TaskContract[]>([]);
  const [agents, setAgents] = React.useState<AgentContract[]>([]);
  const [loaded, setLoaded] = React.useState(false);

  React.useEffect(() => {
    if (!open || loaded || !actor.ready) return;
    Promise.all([
      listProjects({ actorId: actor.actorId, actorRole: actor.actorRole }),
      listTasks({ actorId: actor.actorId, actorRole: actor.actorRole }, { limit: 200 }),
      listAgents({ actorId: actor.actorId, actorRole: actor.actorRole }, { limit: 200 }),
    ])
      .then(([p, t, a]) => {
        setProjects(p.items);
        setTasks(t.items);
        setAgents(a.items);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [open, loaded, actor.ready, actor.actorId, actor.actorRole]);

  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onOpenChange]);

  const go = (href: string) => {
    onOpenChange(false);
    router.push(href as never);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search routes, projects, tasks, agents…" />
      <CommandList>
        <CommandEmpty>No matches.</CommandEmpty>
        <CommandGroup heading="Routes">
          {ROUTES.map((r) => (
            <CommandItem key={r.id} onSelect={() => go(r.href)}>
              {r.label}
            </CommandItem>
          ))}
        </CommandGroup>
        {projects.length > 0 && (
          <CommandGroup heading="Projects">
            {projects.map((p) => (
              <CommandItem
                key={`project:${p.id}`}
                onSelect={() => go(`/operations?project=${p.id}`)}
              >
                {p.name}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {tasks.length > 0 && (
          <CommandGroup heading="Tasks">
            {tasks.slice(0, 30).map((t) => (
              <CommandItem
                key={`task:${t.id}`}
                onSelect={() => go(`/tasks?project=${t.project_id}&task=${t.id}`)}
              >
                {t.title}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {agents.length > 0 && (
          <CommandGroup heading="Agents">
            {agents.slice(0, 30).map((a) => (
              <CommandItem
                key={`agent:${a.id}`}
                onSelect={() => go(`/agents?id=${a.id}`)}
              >
                {a.name}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
