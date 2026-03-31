"use client";

import { useUser } from "@clerk/nextjs";
import { createContext, useContext } from "react";

type ActorState = {
  ready: boolean;
  actorId: string;
  actorRole: "owner";
  authMode: "clerk" | "local_tester";
  label: string;
};

const ActorContext = createContext<ActorState | null>(null);

export function LocalTesterActorProvider({ children }: { children: React.ReactNode }) {
  const actorId = process.env.NEXT_PUBLIC_DEV_ACTOR_ID?.trim() || "owner-local-dev";

  return (
    <ActorContext.Provider
      value={{
        ready: true,
        actorId,
        actorRole: "owner",
        authMode: "local_tester",
        label: "Local tester auth"
      }}
    >
      {children}
    </ActorContext.Provider>
  );
}

export function ClerkActorProvider({ children }: { children: React.ReactNode }) {
  const { isLoaded, user } = useUser();
  const actorId = user?.id ?? "";
  const label = user?.fullName || user?.username || user?.primaryEmailAddress?.emailAddress || "Signed-in user";

  return (
    <ActorContext.Provider
      value={{
        ready: isLoaded && Boolean(actorId),
        actorId,
        actorRole: "owner",
        authMode: "clerk",
        label
      }}
    >
      {children}
    </ActorContext.Provider>
  );
}

export function useActorContext() {
  const actor = useContext(ActorContext);
  if (!actor) {
    throw new Error("useActorContext must be used inside an actor provider.");
  }
  return actor;
}
