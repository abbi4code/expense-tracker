"use client";

import { ChartPie, House, ReceiptText, Settings, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/home", label: "Home", icon: House },
  { href: "/activity", label: "Activity", icon: ReceiptText },
  { href: "/groups", label: "Groups", icon: Users },
  { href: "/insights", label: "Insights", icon: ChartPie },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

export function TabBar() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/85 pb-safe backdrop-blur-xl"
    >
      <ul className="mx-auto grid h-16 max-w-lg grid-cols-5">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-full flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
                  active ? "text-ink" : "text-subtle",
                )}
              >
                <Icon className="size-[22px]" strokeWidth={active ? 2.25 : 1.75} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
