import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { cn } from "@/lib/utils";

const pillVariants = cva(
  "inline-block rounded-full border px-2 py-px text-label font-medium whitespace-nowrap",
  {
    variants: {
      tone: {
        neutral: "border-border bg-muted text-muted-foreground",
        success: "border-transparent bg-success-soft text-success",
        accent: "border-transparent bg-accent text-accent-foreground",
        ai: "border-transparent bg-ai-soft text-ai",
        warning: "border-transparent bg-warning-soft text-warning",
        destructive: "border-transparent bg-destructive-soft text-destructive",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

// Status pill; the label text carries the meaning, the tone only reinforces it.
function Pill({
  className,
  tone,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof pillVariants>) {
  return (
    <span
      data-slot="pill"
      className={cn(pillVariants({ tone }), className)}
      {...props}
    />
  );
}

type PillTone = NonNullable<VariantProps<typeof pillVariants>["tone"]>;

export { Pill, pillVariants, type PillTone };
