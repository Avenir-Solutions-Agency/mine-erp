"use client";

import { Toast } from "@base-ui/react/toast";
import { hu } from "@/i18n/hu";

// One global manager so any client code can call toast(), like the demo's toast(m).
const toastManager = Toast.createToastManager();

function toast(message: string) {
  toastManager.add({ description: message });
}

function ToastList() {
  const { toasts } = Toast.useToastManager();
  return toasts.map((t) => (
    <Toast.Root
      key={t.id}
      toast={t}
      className="rounded-lg bg-foreground px-3.5 py-2.5 text-control text-background shadow-md"
    >
      <Toast.Content className="flex items-start gap-3">
        <Toast.Description className="flex-1" />
        <Toast.Close
          aria-label={hu.toast.close}
          className="cursor-pointer opacity-70 outline-background hover:opacity-100 focus-visible:outline-2"
        >
          ×
        </Toast.Close>
      </Toast.Content>
    </Toast.Root>
  ));
}

// Demo behaviour: one toast at a time, bottom right, gone after 3.4 s.
function Toaster() {
  return (
    <Toast.Provider toastManager={toastManager} limit={1} timeout={3400}>
      <Toast.Portal>
        <Toast.Viewport className="fixed right-4 bottom-4 z-50 flex w-max max-w-[calc(100vw-2rem)] flex-col sm:max-w-105">
          <ToastList />
        </Toast.Viewport>
      </Toast.Portal>
    </Toast.Provider>
  );
}

export { Toaster, toast };
