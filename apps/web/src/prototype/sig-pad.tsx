"use client";

import { useEffect, useRef } from "react";
import { Btn, Small } from "@/prototype/ui";

/**
 * The demo's sigPad()/bindSig(): a 520×150 canvas the customer signs with a pointer.
 * `id` is the canvas id; read it with sigData(id) when the action runs.
 */
export function SigPad({ id, label }: { id: string; label: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const x = c.getContext("2d")!;
    x.lineWidth = 2.2;
    x.lineCap = "round";
    x.strokeStyle = getComputedStyle(document.body).color;
    let on = false;
    const p = (e: PointerEvent): [number, number] => {
      const r = c.getBoundingClientRect();
      return [
        ((e.clientX - r.left) * c.width) / r.width,
        ((e.clientY - r.top) * c.height) / r.height,
      ];
    };
    const down = (e: PointerEvent) => {
      on = true;
      c.setPointerCapture(e.pointerId);
      const [a, b] = p(e);
      x.beginPath();
      x.moveTo(a, b);
    };
    const moveTo = (e: PointerEvent) => {
      if (!on) return;
      const [a, b] = p(e);
      x.lineTo(a, b);
      x.stroke();
      c.dataset.dirty = "1";
    };
    const up = () => (on = false);
    c.addEventListener("pointerdown", down);
    c.addEventListener("pointermove", moveTo);
    c.addEventListener("pointerup", up);
    c.addEventListener("pointercancel", up);
    return () => {
      c.removeEventListener("pointerdown", down);
      c.removeEventListener("pointermove", moveTo);
      c.removeEventListener("pointerup", up);
      c.removeEventListener("pointercancel", up);
    };
  }, []);
  return (
    <div>
      <Small>{label}</Small>
      <canvas
        ref={ref}
        id={id}
        width={520}
        height={150}
        aria-label={label}
        className="block w-full max-w-130 touch-none rounded-lg border border-dashed border-muted-foreground bg-muted"
      />
      <Btn
        sm
        onClick={() => {
          const c = ref.current!;
          c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
          c.dataset.dirty = "";
        }}
      >
        Törlés
      </Btn>
    </div>
  );
}

/** The demo's sigData(): PNG data URL of a signed pad, null when empty. */
export function sigData(id: string): string | null {
  const c = document.getElementById(id);
  return c instanceof HTMLCanvasElement && c.dataset.dirty
    ? c.toDataURL("image/png")
    : null;
}
