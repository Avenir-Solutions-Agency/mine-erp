"use client";

// Demo building blocks (docs/reference/demo.html CSS: .top, .panel, .grid, .alert, .btn, label.f, .aibox, .flow).
import { useEffect, useRef, type ComponentProps, type ReactNode } from "react";
import { buttonVariants } from "@/components/ui/button";
import { Meter } from "@base-ui/react/meter";
import { cn } from "@/lib/utils";
import { hu } from "@/i18n/hu";

/** .top: h1, optional .sub, right-side controls and the demo date badge. */
export function Head({
  title,
  sub,
  right,
}: {
  title: string;
  sub?: string;
  right?: ReactNode;
}) {
  return (
    <div className="mb-4.5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1>{title}</h1>
        {sub ? (
          <p className="mt-1.5 max-w-prose text-muted-foreground">{sub}</p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {right}
        <span className="rounded-lg border border-dashed border-border px-2 py-0.5 text-label text-muted-foreground">
          {hu.demo.badge}
        </span>
      </div>
    </div>
  );
}

export function Panel({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-lg border border-border bg-card p-4",
        className,
      )}
      {...props}
    />
  );
}

const GRID = {
  1: "grid-cols-1",
  2: "grid-cols-1 md:grid-cols-2",
  3: "grid-cols-1 lg:grid-cols-3",
  4: "grid-cols-1 md:grid-cols-2 lg:grid-cols-4",
} as const;
/** .grid.g2/.g3/.g4 with the demo breakpoints (980px, 760px). */
export function Grid({
  cols,
  className,
  ...props
}: ComponentProps<"div"> & { cols: keyof typeof GRID }) {
  return (
    <div className={cn("grid gap-3.5", GRID[cols], className)} {...props} />
  );
}

export function Stack({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-3.5", className)} {...props} />;
}

export function Row({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("flex flex-wrap items-center gap-2", className)}
      {...props}
    />
  );
}

export function Spread({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-2",
        className,
      )}
      {...props}
    />
  );
}

export type Level = "ok" | "warn" | "bad" | "ai" | "";
const DOT: Record<Level, string> = {
  ok: "bg-success",
  warn: "bg-warning",
  bad: "bg-destructive",
  ai: "bg-ai",
  "": "bg-muted-foreground",
};
export function Dot({ lvl }: { lvl: Level }) {
  return (
    <span
      aria-hidden="true"
      className={cn("mt-1.5 size-2 shrink-0 rounded-full", DOT[lvl])}
    />
  );
}
/** .alert: a dot and a line; the text carries the meaning. */
export function Alert({ lvl, children }: { lvl: Level; children: ReactNode }) {
  return (
    <div className="flex gap-2.5 border-b border-border py-2.25 last:border-b-0">
      <Dot lvl={lvl} />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

type BtnKind = "default" | "pri" | "ai" | "bad";
const BTN: Record<BtnKind, string> = {
  default: cn(
    buttonVariants({ variant: "outline" }),
    "bg-card hover:border-muted-foreground",
  ),
  pri: buttonVariants({ variant: "default" }),
  ai: buttonVariants({ variant: "ai" }),
  bad: cn(buttonVariants({ variant: "outline" }), "bg-card text-destructive"),
};
/** .btn, .btn.pri, .btn.ai, .btn.bad and .sm */
export function Btn({
  kind = "default",
  sm,
  className,
  type = "button",
  ...props
}: ComponentProps<"button"> & { kind?: BtnKind; sm?: boolean }) {
  return (
    <button
      type={type}
      className={cn(
        BTN[kind],
        // .btn wraps long labels instead of overflowing narrow screens.
        "h-auto min-h-8 shrink text-control whitespace-normal",
        sm && "min-h-6 px-2 text-xs",
        className,
      )}
      {...props}
    />
  );
}

/** label.f: 12px muted label above the control. */
export function Field({
  label,
  className,
  children,
}: {
  label: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label
      className={cn(
        "flex flex-col gap-0.75 text-xs text-muted-foreground",
        className,
      )}
    >
      {label}
      {children}
    </label>
  );
}

const CONTROL =
  "rounded-lg border border-input bg-card px-2 py-1.5 text-control text-foreground outline-ring focus-visible:outline-2 focus-visible:outline-offset-1 max-w-full";

/** Native change event (blur or Enter), like the demo's document 'change' listener. */
function useNativeChange<
  T extends HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
>(onCommit: ((el: T) => void) | undefined) {
  const ref = useRef<T>(null);
  const handler = useRef(onCommit);
  useEffect(() => {
    handler.current = onCommit;
  });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fn = () => handler.current?.(el);
    el.addEventListener("change", fn);
    return () => el.removeEventListener("change", fn);
  }, []);
  return ref;
}

export function Inp({
  onCommit,
  className,
  ...props
}: Omit<ComponentProps<"input">, "ref"> & {
  onCommit?: (el: HTMLInputElement) => void;
}) {
  const ref = useNativeChange<HTMLInputElement>(onCommit);
  return <input ref={ref} className={cn(CONTROL, className)} {...props} />;
}

export function Sel({
  onCommit,
  className,
  ...props
}: Omit<ComponentProps<"select">, "ref"> & {
  onCommit?: (el: HTMLSelectElement) => void;
}) {
  const ref = useNativeChange<HTMLSelectElement>(onCommit);
  return <select ref={ref} className={cn(CONTROL, className)} {...props} />;
}

export function Area({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(CONTROL, "w-full resize-y font-mono text-xs", className)}
      {...props}
    />
  );
}

/** .aibox: amber left rule, uppercase agent name. */
export function AiBox({
  who,
  className,
  children,
}: {
  who: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-l-3 border-border border-l-ai bg-card px-3.5 py-3",
        className,
      )}
    >
      <div className="text-label font-semibold tracking-wider text-ai uppercase">
        {who}
      </div>
      {children}
    </div>
  );
}

/** .flow: process step chips; `on` steps are highlighted. */
export function Flow({
  steps,
  className,
  vertical,
}: {
  steps: [string, boolean][];
  className?: string;
  vertical?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-1 text-xs",
        vertical && "flex-col items-start",
        className,
      )}
    >
      {steps.map(([s, on], i) => (
        <span key={i} className="contents">
          {i > 0 && !vertical ? <span aria-hidden="true">→</span> : null}
          <span
            className={cn(
              "rounded-full border border-border bg-muted px-2.25 py-0.75",
              on &&
                "border-transparent bg-accent font-semibold text-accent-foreground",
            )}
          >
            {s}
          </span>
        </span>
      ))}
    </div>
  );
}

/** .bar with a fill of `pct` percent; tone follows the demo's warn/bad classes. */
export function Bar({
  pct,
  tone,
  label,
  className,
}: {
  pct: number;
  tone?: "" | "warn" | "bad";
  label: string;
  className?: string;
}) {
  const v = Math.max(0, Math.min(100, pct));
  return (
    <Meter.Root
      value={v}
      max={100}
      aria-label={label}
      className={cn("min-w-15", className)}
    >
      <Meter.Track className="block h-1.5 overflow-hidden rounded-full bg-muted">
        <Meter.Indicator
          className={cn(
            "block h-full",
            tone === "warn"
              ? "bg-warning"
              : tone === "bad"
                ? "bg-destructive"
                : "bg-primary",
          )}
        />
      </Meter.Track>
    </Meter.Root>
  );
}

export function Legend({
  items,
  extra,
}: {
  items: [string, string][];
  extra?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap gap-3.5 text-xs text-muted-foreground">
      {items.map(([color, label]) => (
        <span key={label}>
          <i
            className="mr-1.25 inline-block size-2.5 rounded-xs align-middle"
            style={{ background: color }}
          />
          {label}
        </span>
      ))}
      {extra}
    </div>
  );
}

export function Small({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("text-xs text-muted-foreground", className)}
      {...props}
    />
  );
}

export function Mono({ className, ...props }: ComponentProps<"span">) {
  return <span className={cn("font-mono text-xs", className)} {...props} />;
}

/** pre.json: payload preview. */
export function Json({ value }: { value: unknown }) {
  return (
    <pre className="max-h-80 overflow-auto rounded-lg border border-border bg-muted p-2.5 font-mono text-label">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

/** Value of a named control in a form, the demo's document.getElementById(id).value. */
export function formValue(
  form: HTMLFormElement | null | undefined,
  name: string,
): string {
  const el = form?.elements.namedItem(name);
  return el && "value" in el ? String(el.value) : "";
}

/** Checked state of a named checkbox in a form. */
export function formChecked(
  form: HTMLFormElement | null | undefined,
  name: string,
): boolean {
  const el = form?.elements.namedItem(name);
  return !!el && "checked" in el && !!el.checked;
}

/** .tabs: buttons with aria-selected; `onSelect` calls the engine action that stores the tab. */
export function TabBar({
  items,
  active,
  onSelect,
}: {
  items: [string, string][];
  active: string;
  onSelect: (key: string) => void;
}) {
  return (
    <div
      role="tablist"
      className="mb-3.5 flex flex-wrap gap-1 border-b border-border"
    >
      {items.map(([k, l]) => (
        <button
          key={k}
          type="button"
          role="tab"
          aria-selected={active === k}
          onClick={() => onSelect(k)}
          className="-mb-px cursor-pointer border-b-2 border-transparent px-3 py-2 text-control text-muted-foreground outline-ring focus-visible:outline-2 focus-visible:outline-offset-1 aria-selected:border-primary aria-selected:font-semibold aria-selected:text-foreground"
        >
          {l}
        </button>
      ))}
    </div>
  );
}
