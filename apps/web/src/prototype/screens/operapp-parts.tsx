"use client";

import type { ComponentProps, ReactNode } from "react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { readPhoto } from "@/prototype/files";

/** .phone: the mobile app frame of the demo apps (operapp, mechapp, qr). */
export function Phone({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "max-w-130 min-w-0 rounded-2xl border border-border bg-card p-4",
        className,
      )}
      {...props}
    />
  );
}

/** label.btn with a hidden camera input; without `onPhoto` the file is ignored, like the demo's mechanic app. */
export function PhotoBtn({
  children,
  onPhoto,
  sm,
}: {
  children: ReactNode;
  onPhoto?: (img: string) => void;
  sm?: boolean;
}) {
  return (
    <label
      className={cn(
        buttonVariants({ variant: "outline" }),
        "cursor-pointer text-control",
        sm && "h-6 px-2 text-xs",
      )}
    >
      {children}
      <input
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => {
          const file = e.currentTarget.files?.[0];
          if (file && onPhoto)
            void readPhoto(file).then(({ img }) => onPhoto(img));
        }}
      />
    </label>
  );
}
