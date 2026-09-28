"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useHydrated } from "@/lib/use-hydrated";
import { cn } from "@/lib/utils";

const options = [
  { value: "system", label: "Auto", icon: Monitor },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
] as const;

export function ThemePicker() {
  const { theme, setTheme } = useTheme();
  // The stored theme is only known on the client; avoid a hydration mismatch.
  const mounted = useHydrated();

  return (
    <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-1 rounded-2xl bg-surface-2 p-1">
      {options.map(({ value, label, icon: Icon }) => {
        const selected = mounted && theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => setTheme(value)}
            className={cn(
              "flex h-10 items-center justify-center gap-1.5 rounded-xl text-sm font-medium transition",
              selected ? "bg-surface text-ink shadow-sm" : "text-muted",
            )}
          >
            <Icon className="size-4" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
