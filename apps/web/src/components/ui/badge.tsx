import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
  {
    variants: {
      tone: {
        signal: "bg-signal-dim text-signal",
        warn: "bg-warn-dim text-warn",
        danger: "bg-danger-dim text-danger",
        info: "bg-info-dim text-info",
        accent: "bg-accent-dim text-accent",
        neutral: "bg-canvas-raised text-ink-secondary border border-edge",
      },
    },
    defaultVariants: { tone: "neutral" },
  }
);

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export const Badge = ({ className, tone, ...props }: BadgeProps) => (
  <span className={cn(badgeVariants({ tone, className }))} {...props} />
);
