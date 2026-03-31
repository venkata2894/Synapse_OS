"use client";

import { useActorContext } from "@/components/actor-provider";

export function useActor() {
  const actor = useActorContext();
  return actor;
}
