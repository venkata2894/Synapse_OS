"use client";

import { useUser } from "@clerk/nextjs";

export function useActor() {
  const { isLoaded, user } = useUser();
  const devBypassAuth = process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH === "true";
  const devActorId = process.env.NEXT_PUBLIC_DEV_ACTOR_ID?.trim() || "owner-local-dev";
  const actorId = user?.id ?? (devBypassAuth ? devActorId : "");

  return {
    ready: isLoaded && Boolean(actorId),
    actorId,
    actorRole: "owner" as const
  };
}
