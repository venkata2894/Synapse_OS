import * as React from "react";
import { cn } from "@/lib/cn";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "min-h-[80px] w-full rounded-xl border border-edge bg-canvas-inset px-3 py-2 text-sm text-ink placeholder:text-ink-ghost focus:border-signal/50 focus:outline-none focus:ring-2 focus:ring-signal/20",
        className
      )}
      {...props}
    />
  )
);
Textarea.displayName = "Textarea";
