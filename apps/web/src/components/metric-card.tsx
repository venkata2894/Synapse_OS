import * as React from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";

type Tone = "signal" | "warn" | "danger" | "accent" | "info" | "neutral";

const TONE: Record<Tone, string> = {
  signal: "text-signal",
  warn: "text-warn",
  danger: "text-danger",
  accent: "text-accent",
  info: "text-info",
  neutral: "text-ink",
};

export function MetricCard({
  label,
  value,
  tone = "neutral",
  className,
}: {
  label: string;
  value: number | string;
  tone?: Tone;
  className?: string;
}) {
  return (
    <Card className={cn("p-4", className)}>
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-tertiary">{label}</p>
      <p className={cn("mt-1 font-display text-3xl font-bold", TONE[tone])}>{value}</p>
    </Card>
  );
}
