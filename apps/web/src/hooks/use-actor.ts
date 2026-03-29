"use client";

import { useUser } from "@clerk/nextjs";

export function useActor() {
  const { isLoaded, user } = useUser();

  return {
    ready: isLoaded && Boolean(user?.id),
    actorId: user?.id ?? "",
    actorRole: "owner" as const
  };
}

