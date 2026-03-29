export function shortDate(value: string | null | undefined): string {
  if (!value) return "N/A";
  const date = new Date(value);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

export function clampPercent(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

