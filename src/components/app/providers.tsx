"use client";

import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { ServiceWorkerRegister } from "@/components/app/service-worker-register";
// Side effect: start listening for the install prompt as early as possible.
import "@/lib/pwa/install";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
      <Toaster
        position="top-center"
        offset="calc(env(safe-area-inset-top) + 12px)"
        mobileOffset="calc(env(safe-area-inset-top) + 12px)"
        toastOptions={{
          classNames: {
            toast: "!rounded-2xl !border-line !bg-surface !text-ink !shadow-lg !shadow-black/5 !font-sans",
            description: "!text-muted",
            actionButton: "!rounded-full !bg-ink !text-bg !font-medium",
          },
        }}
      />
      <ServiceWorkerRegister />
    </ThemeProvider>
  );
}
