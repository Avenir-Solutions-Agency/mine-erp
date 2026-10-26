import { Toaster } from "@/components/ui/toast";
import { hu } from "@/i18n/hu";
import { SideNav } from "@/prototype/side-nav";

// App shell of the demo: 232px sticky side rail, a horizontal nav bar below md (760px).
export default function PrototypeLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-full flex-1 flex-col md:flex-row">
      <aside className="flex shrink-0 overflow-x-auto border-b border-border bg-card px-4 py-2.5 md:sticky md:top-0 md:h-svh md:w-58 md:flex-col md:gap-1 md:overflow-y-auto md:border-r md:border-b-0 md:px-3 md:py-4.5">
        <div className="hidden px-2 pb-3.5 font-heading text-2xl leading-tight font-bold tracking-wide md:block">
          {hu.brand.name}
          <small className="mt-1 block font-sans text-label font-normal tracking-wider text-muted-foreground uppercase">
            {hu.brand.env}
          </small>
        </div>
        {/* shortcut: badges stay empty until the prototype store lands (T-024). */}
        <SideNav counts={{}} />
      </aside>
      <main className="min-w-0 flex-1 px-4 pt-5.5 pb-15 md:px-7">
        {children}
      </main>
      <Toaster />
    </div>
  );
}
