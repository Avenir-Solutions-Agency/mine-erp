"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { hu } from "@/i18n/hu";
import { cn } from "@/lib/utils";
import { NAV } from "@/prototype/nav";
import { useDemoCounts } from "@/prototype/store";

export function SideNav() {
  const pathname = usePathname();
  const counts = useDemoCounts();
  return (
    <nav
      aria-label={hu.nav.label}
      className="flex gap-0.5 md:flex-col md:gap-0"
    >
      {NAV.map(({ group, items }) => (
        <div key={group} className="contents">
          <div className="hidden px-2 pt-3 pb-1 text-label tracking-widest text-muted-foreground uppercase md:block">
            {hu.nav.groups[group]}
          </div>
          {items.map(({ id, counter, enabled }) => {
            const count = counter ? counts[counter] : undefined;
            const current = pathname === `/${id}`;
            if (!enabled)
              return (
                <span
                  key={id}
                  aria-disabled="true"
                  className="cursor-not-allowed rounded-lg px-2.5 py-1.75 text-control whitespace-nowrap opacity-50 md:w-fit"
                >
                  {hu.nav.routes[id]}
                </span>
              );
            return (
              <Link
                key={id}
                href={`/${id}`}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.75 text-control whitespace-nowrap outline-ring hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-1 md:w-fit",
                  current && "bg-accent font-semibold text-accent-foreground",
                )}
              >
                <span>{hu.nav.routes[id]}</span>
                {count ? (
                  <span className="rounded-full bg-ai-soft px-1.75 font-mono text-label text-ai">
                    {count}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
