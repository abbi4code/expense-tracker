"use client";

import { Briefcase, ChevronRight } from "lucide-react";
import Link from "next/link";
import { sumMinor, useOwedBack, useProfile } from "@/lib/db/queries";
import { formatMoney } from "@/lib/money";

/** Work expenses waiting to be paid back. */
export function ClaimCard() {
  const owed = useOwedBack();
  const profile = useProfile();
  if (!owed?.length) return null;
  return (
    <Link
      href="/activity?claim=1"
      className="mt-4 flex items-center gap-3 rounded-card border border-line bg-surface p-4 transition active:bg-surface-2"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-2">
        <Briefcase className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold tabular-nums">
          {formatMoney(sumMinor(owed), profile?.currency ?? "INR")} to claim back
        </span>
        <span className="block text-sm text-muted">
          {owed.length} work {owed.length === 1 ? "expense" : "expenses"} · not counted in your spending
        </span>
      </span>
      <ChevronRight className="size-5 text-subtle" />
    </Link>
  );
}
