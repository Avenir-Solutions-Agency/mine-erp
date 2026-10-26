import type * as React from "react";
import { cn } from "@/lib/utils";

// Key figure tile: uppercase label, large display value, optional muted detail line.
function Kpi({
  label,
  value,
  detail,
  className,
}: {
  label: string;
  value: React.ReactNode;
  detail?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      data-slot="kpi"
      className={cn(
        "min-w-0 rounded-lg border border-border bg-card p-4",
        className,
      )}
    >
      <div className="text-label tracking-wider text-muted-foreground uppercase">
        {label}
      </div>
      <div className="mt-1 font-heading text-3xl leading-tight font-semibold tabular-nums">
        {value}
      </div>
      {detail ? (
        <div className="text-xs text-muted-foreground">{detail}</div>
      ) : null}
    </div>
  );
}

export { Kpi };
