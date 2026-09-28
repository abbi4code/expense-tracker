"use client";

import { Drawer } from "vaul";
import { cn } from "@/lib/utils";

type SheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Visually hide the title (it is still read by screen readers). */
  hideTitle?: boolean;
  description?: string;
  children: React.ReactNode;
  className?: string;
};

/** Bottom sheet: the app's main surface for quick actions. Swipe down to dismiss. */
export function Sheet({ open, onOpenChange, title, hideTitle, description, children, className }: SheetProps) {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]" />
        <Drawer.Content
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[92dvh] w-full max-w-lg flex-col",
            "rounded-t-[2rem] border border-b-0 border-line bg-bg pb-safe outline-none",
            className,
          )}
        >
          <div className="mx-auto mt-3 h-1.5 w-10 shrink-0 rounded-full bg-line" aria-hidden />
          <div className={cn("px-6 pt-4", hideTitle && "sr-only")}>
            <Drawer.Title className="text-xl font-semibold tracking-tight">{title}</Drawer.Title>
            {description && (
              <Drawer.Description className="mt-1 text-[15px] text-muted">{description}</Drawer.Description>
            )}
          </div>
          {!description && <Drawer.Description className="sr-only">{title}</Drawer.Description>}
          <div className={cn("overflow-y-auto px-6 pb-6", hideTitle ? "pt-3" : "pt-4")}>{children}</div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
