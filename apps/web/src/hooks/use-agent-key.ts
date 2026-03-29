"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "synapse.agent_api_key";

export function useAgentKey() {
  const [agentKey, setAgentKey] = useState("");
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const existing = window.sessionStorage.getItem(STORAGE_KEY);
    if (existing) {
      setAgentKey(existing);
    }
    setIsLoaded(true);
  }, []);

  const saveAgentKey = (value: string) => {
    setAgentKey(value);
    if (value.trim()) {
      window.sessionStorage.setItem(STORAGE_KEY, value.trim());
    } else {
      window.sessionStorage.removeItem(STORAGE_KEY);
    }
  };

  return {
    agentKey,
    isLoaded,
    saveAgentKey
  };
}

