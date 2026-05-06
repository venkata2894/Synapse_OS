import * as React from "react";

type Score = { label: string; value: number };

export function ScoreRadar({
  scores,
  max = 10,
  size = 140,
}: {
  scores: Score[];
  max?: number;
  size?: number;
}) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 12;
  const n = scores.length;

  const points = scores.map((s, i) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    const v = Math.max(0, Math.min(max, s.value)) / max;
    return [cx + Math.cos(angle) * r * v, cy + Math.sin(angle) * r * v] as const;
  });
  const path = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ") + " Z";

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
      {[0.25, 0.5, 0.75, 1].map((t, i) => (
        <circle key={i} cx={cx} cy={cy} r={r * t} fill="none" stroke="var(--edge)" strokeOpacity={0.4} />
      ))}
      {scores.map((_, i) => {
        const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
        return (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={cx + Math.cos(angle) * r}
            y2={cy + Math.sin(angle) * r}
            stroke="var(--edge)"
            strokeOpacity={0.4}
          />
        );
      })}
      <path d={path} fill="var(--signal-dim)" stroke="var(--signal)" strokeWidth={1.5} />
    </svg>
  );
}
