import { STATUS_CLASS } from "@mine-erp/domain/demo";
import { Pill, type PillTone } from "@/components/ui/pill";

/** Demo pill classes (ok, acc, ai, warn, bad, '') as design-system tones. */
const TONE: Record<string, PillTone> = {
  ok: "success",
  acc: "accent",
  ai: "ai",
  warn: "warning",
  bad: "destructive",
  "": "neutral",
};

export const pillTone = (cls: string): PillTone => TONE[cls] ?? "neutral";

/** Demo stPill(): unknown statuses are neutral. */
export function StatusPill({ status }: { status: string }) {
  return <Pill tone={pillTone(STATUS_CLASS[status] ?? "")}>{status}</Pill>;
}
