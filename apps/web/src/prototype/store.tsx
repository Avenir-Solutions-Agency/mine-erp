"use client";

import { createDemo, type Demo } from "@mine-erp/domain/demo";
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  use,
  useEffect,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { toast } from "@/components/ui/toast";
import { downloadFile } from "@/prototype/files";
import { hu } from "@/i18n/hu";

// One engine per browser tab; a reload starts again from an empty database.
let instance: Demo | null = null;
function getDemo(): Demo {
  instance ??= createDemo({
    empty: true,
    now: () => Date.now(),
    random: () => Math.random(),
    sha256: async (text) => {
      const digest = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(text),
      );
      return [...new Uint8Array(digest)]
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    },
  });
  return instance;
}
const noSubscribe = () => () => {};
// The engine's route and navigation hooks live outside React state (the demo's `route` and go()).
function connect(demo: Demo, navigate: (r: string) => void) {
  demo.ui.navigate = navigate;
  demo.ui.download = downloadFile;
}
function setRoute(demo: Demo, route: string) {
  demo.ui.route = route;
}

const DemoContext = createContext<Demo | null>(null);

export function DemoProvider({ children }: { children: ReactNode }) {
  // Server snapshot is null: the engine only exists in the browser, so its random seed never mismatches.
  const demo = useSyncExternalStore(noSubscribe, getDemo, () => null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!demo) return;
    connect(demo, (r) => router.push(`/${r}`));
    const off = demo.onToast(toast);
    return () => void off();
  }, [demo, router]);
  useEffect(() => {
    if (demo) setRoute(demo, pathname.slice(1));
  }, [demo, pathname]);

  return <DemoContext value={demo}>{children}</DemoContext>;
}

/** Shows the loading line until the engine exists (first client render). */
export function DemoReady({ children }: { children: ReactNode }) {
  if (!use(DemoContext))
    return <p className="text-sm text-muted-foreground">{hu.loading}</p>;
  return children;
}

function useVersion(demo: Demo | null) {
  useSyncExternalStore(
    (l) => {
      if (!demo) return () => {};
      const off = demo.subscribe(l);
      return () => void off();
    },
    () => demo?.version ?? -1,
    () => -1,
  );
}

/** Nav badge counts; empty until the engine is ready. */
export function useDemoCounts(): Record<string, number> {
  const demo = use(DemoContext);
  useVersion(demo);
  return demo ? demo.q.counts() : {};
}

/** The engine; the calling component re-renders on every demo render(). */
export function useDemo(): Demo {
  const demo = use(DemoContext);
  useVersion(demo);
  if (!demo) throw new Error("useDemo outside DemoReady");
  return demo;
}
