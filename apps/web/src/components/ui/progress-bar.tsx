"use client";

import { Meter } from "@base-ui/react/meter";
import { cn } from "@/lib/utils";

const toneClass = {
  default: "bg-primary",
  warning: "bg-warning",
  destructive: "bg-destructive",
} as const;

// Thin fill bar for utilisation and progress (demo `.bar`). Needs an accessible label.
function ProgressBar({
  value,
  max = 100,
  tone = "default",
  className,
  "aria-label": ariaLabel,
}: {
  value: number;
  max?: number;
  tone?: keyof typeof toneClass;
  className?: string;
  "aria-label": string;
}) {
  return (
    <Meter.Root
      data-slot="progress-bar"
      value={Math.min(Math.max(value, 0), max)}
      max={max}
      aria-label={ariaLabel}
      className={cn("min-w-15", className)}
    >
      <Meter.Track className="block h-1.5 overflow-hidden rounded-full bg-muted">
        <Meter.Indicator className={cn("block h-full", toneClass[tone])} />
      </Meter.Track>
    </Meter.Root>
  );
}

export { ProgressBar };
