"use client";

import { useStreak } from "@/lib/db/queries";

/** "🔥 5": days in a row with something logged. Shown from 2 days; no guilt when it resets. */
export function StreakChip() {
  const streak = useStreak();
  if (!streak || streak.streak < 2) return null;
  return (
    <span
      className="inline-flex h-7 items-center gap-1 rounded-full bg-surface-2 px-2.5 text-xs font-semibold tabular-nums"
      title={`${streak.streak}-day streak`}
      aria-label={`${streak.streak}-day logging streak`}
    >
      🔥 {streak.streak}
    </span>
  );
}
