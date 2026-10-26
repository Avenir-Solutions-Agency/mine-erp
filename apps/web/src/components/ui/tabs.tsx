"use client";

import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import { cn } from "@/lib/utils";

function Tabs(props: TabsPrimitive.Root.Props) {
  return <TabsPrimitive.Root data-slot="tabs" {...props} />;
}

function TabsList({ className, ...props }: TabsPrimitive.List.Props) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        "mb-3.5 flex flex-wrap gap-1 border-b border-border",
        className,
      )}
      {...props}
    />
  );
}

function TabsTab({ className, ...props }: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-tab"
      className={cn(
        "-mb-px cursor-pointer border-b-2 border-transparent px-3 py-2 text-control text-muted-foreground outline-ring focus-visible:outline-2 focus-visible:outline-offset-1 data-active:border-primary data-active:font-semibold data-active:text-foreground",
        className,
      )}
      {...props}
    />
  );
}

function TabsPanel(props: TabsPrimitive.Panel.Props) {
  return <TabsPrimitive.Panel data-slot="tabs-panel" {...props} />;
}

export { Tabs, TabsList, TabsTab, TabsPanel };
