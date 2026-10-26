"use client";

import type { ComponentProps, ReactNode } from "react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { readPhoto } from "@/prototype/files";

/** The demo's `label.btn` with a hidden `data-photo` file input (camera on phones). */
export function PhotoBtn({
  children,
  sm,
  accept = "image/*",
  onPhoto,
}: {
  children: ReactNode;
  sm?: boolean;
  /** The contract upload also takes PDFs and has no camera hint. */
  accept?: string;
  onPhoto: (img: string, name: string) => void;
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
        accept={accept}
        capture={accept === "image/*" ? "environment" : undefined}
        hidden
        onChange={(e) => {
          const file = e.currentTarget.files?.[0];
          if (file)
            void readPhoto(file).then(({ img, name }) => onPhoto(img, name));
        }}
      />
    </label>
  );
}

/** pre.doc: a printable document preview. */
export function DocBlock({ className, ...props }: ComponentProps<"pre">) {
  return (
    <pre
      className={cn(
        "max-h-105 overflow-auto rounded-lg border border-border bg-muted p-3.5 font-sans text-control whitespace-pre-wrap",
        className,
      )}
      {...props}
    />
  );
}

/** img.sigimg: a captured signature or photo. */
export function SigImg({ src, alt }: { src: string; alt: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- data URL from a canvas or a photo, nothing for next/image to optimise
    <img
      src={src}
      alt={alt}
      className="mt-1 block max-w-65 rounded-xs border border-border bg-white"
    />
  );
}
