import * as React from "react";
import { cn } from "@/lib/cn";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-10 w-full rounded-xl border border-edge bg-canvas-inset px-3 text-sm text-ink placeholder:text-ink-ghost focus:border-signal/50 focus:outline-none focus:ring-2 focus:ring-signal/20",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";
