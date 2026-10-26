import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// One line saying what belongs here, plus at most one primary action (DESIGN_SYSTEM.md §06).
function EmptyState({
  message,
  action,
  className,
}: {
  message: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      data-slot="empty-state"
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border p-8 text-center",
        className,
      )}
    >
      <p className="text-sm text-muted-foreground">{message}</p>
      {action}
    </div>
  );
}

export { EmptyState };
