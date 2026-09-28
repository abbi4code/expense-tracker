"use client";

import { useProfile } from "@/lib/db/queries";
import { periodContaining, todayISO } from "@/lib/dates";

/** The current budgeting month, respecting the user's month start day. */
export function useCurrentPeriod() {
  const profile = useProfile();
  const monthStartDay = profile?.month_start_day ?? 1;
  return { period: periodContaining(todayISO(), monthStartDay), monthStartDay, profile };
}
