"use client";

import { ChevronRight, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { SyncStatus } from "@/components/app/sync-status";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useGroupsOverview, useProfile } from "@/lib/db/queries";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { balanceText } from "./format";
import { NewGroupSheet } from "./new-group-sheet";

export function GroupsScreen() {
  const groups = useGroupsOverview();
  const profile = useProfile();
  const [creating, setCreating] = useState(false);
  const currency = profile?.currency ?? "INR";

  // Totals only across groups in your main currency (others are shown per group).
  const same = (groups ?? []).filter((g) => g.group.currency === currency);
  const owed = same.reduce((sum, g) => sum + Math.max(0, g.myBalance), 0);
  const owe = same.reduce((sum, g) => sum + Math.max(0, -g.myBalance), 0);

  return (
    <>
      <header className="flex h-16 items-center justify-between pt-2">
        <h1 className="text-[1.75rem] font-semibold tracking-tight">Groups</h1>
        <div className="flex items-center gap-2">
          <SyncStatus />
          {groups && groups.length > 0 && (
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus className="size-4" /> New
            </Button>
          )}
        </div>
      </header>

      {!groups ? (
        <Skeleton className="h-40" />
      ) : groups.length === 0 ? (
        <EmptyState
          emoji="👥"
          title="Split bills with friends"
          description="Trips, flatmates, dinners. Add who paid, split it, and see who owes whom."
          action={<Button onClick={() => setCreating(true)}>Create a group</Button>}
        />
      ) : (
        <>
          <Card className="mb-5 grid grid-cols-2 divide-x divide-line p-0">
            <div className="p-4">
              <p className="text-sm text-muted">You&apos;re owed</p>
              <p className="mt-0.5 text-xl font-semibold text-success tabular-nums">{formatMoney(owed, currency)}</p>
            </div>
            <div className="p-4">
              <p className="text-sm text-muted">You owe</p>
              <p className="mt-0.5 text-xl font-semibold tabular-nums">{formatMoney(owe, currency)}</p>
            </div>
          </Card>
          <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
            {groups.map(({ group, memberCount, myBalance }) => {
              const balance = balanceText(myBalance, group.currency);
              return (
                <li key={group.id}>
                  <Link
                    href={`/groups/${group.id}`}
                    className="flex items-center gap-3 px-4 py-3.5 transition active:bg-surface-2"
                  >
                    <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-surface-2 text-xl">
                      {group.emoji}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold">{group.name}</span>
                      <span className="block text-sm text-muted">
                        {memberCount} {memberCount === 1 ? "person" : "people"} ·{" "}
                        <span className={cn("font-medium", balance.tone)}>{balance.text}</span>
                      </span>
                    </span>
                    <ChevronRight className="size-5 text-subtle" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <NewGroupSheet open={creating} onOpenChange={setCreating} />
    </>
  );
}
