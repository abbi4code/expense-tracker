"use client";

import { ArrowRight, Plus, Settings2, UserPlus } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { BackHeader } from "@/components/app/back-header";
import { useData } from "@/components/data/data-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Sheet } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { relativeDayLabel } from "@/lib/dates";
import type { GroupExpense } from "@/lib/db/local";
import { useGroupDetail, useInitialSyncDone } from "@/lib/db/queries";
import { formatMoney } from "@/lib/money";
import type { Split, Transfer } from "@/lib/splits";
import { useHiddenWhileScrollingDown } from "@/lib/use-scroll-direction";
import { cn } from "@/lib/utils";
import { balanceText, memberName } from "./format";
import { GroupExpenseForm } from "./group-expense-form";
import { GroupSettingsSheet, shareInvite } from "./group-settings-sheet";
import { MemberAvatar } from "./member-avatar";
import { SettleSheet } from "./settle-sheet";

type Tab = "expenses" | "balances";

export function GroupScreen({ groupId }: { groupId: string }) {
  const detail = useGroupDetail(groupId);
  const fabHidden = useHiddenWhileScrollingDown();
  const synced = useInitialSyncDone();
  const { sync } = useData();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<Tab>("expenses");
  const [editing, setEditing] = useState<{ open: boolean; expense: GroupExpense | null; version: number }>({
    open: false,
    expense: null,
    version: 0,
  });
  const [settling, setSettling] = useState<Transfer | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Just created (or joined): make sure the group is here, and nudge to invite people.
  useEffect(() => {
    if (detail === null) sync();
  }, [detail, sync]);
  const [inviteDismissed, setInviteDismissed] = useState(false);
  const invitePrompt = searchParams.get("invite") === "1" && !inviteDismissed;
  const setInvitePrompt = (open: boolean) => {
    if (open) return;
    setInviteDismissed(true);
    router.replace(pathname, { scroll: false });
  };

  if (detail === undefined || (detail === null && !synced)) return <Skeleton className="mt-6 h-64" />;
  if (detail === null || detail.group.deleted_at || !detail.me) {
    return (
      <>
        <BackHeader href="/groups" backLabel="Groups" title="Group" />
        <EmptyState emoji="🫥" title="Group not found" description="It may have been deleted, or you left it." />
      </>
    );
  }

  const { group, members, active, me, expenses, settlements, balances, transfers } = detail;
  const currency = group.currency;
  const byId = new Map(members.map((m) => [m.id, m]));
  const myBalance = balances.get(me.id) ?? 0;
  const mine = balanceText(myBalance, currency);
  const myTransfers = transfers.filter((t) => t.from === me.id || t.to === me.id);
  const openAdd = () => setEditing((s) => ({ open: true, expense: null, version: s.version + 1 }));

  // One timeline: expenses and payments, newest first, grouped by day.
  const timeline = [
    ...expenses.map((e) => ({ kind: "expense" as const, day: e.spent_on, at: e.created_at, expense: e })),
    ...settlements.map((s) => ({ kind: "settlement" as const, day: s.spent_on, at: s.created_at, settlement: s })),
  ].sort((a, b) => b.day.localeCompare(a.day) || b.at.localeCompare(a.at));
  const days = [...new Set(timeline.map((t) => t.day))];

  return (
    <>
      <BackHeader
        href="/groups"
        backLabel="Groups"
        title={`${group.emoji} ${group.name}`}
        action={
          <div className="flex gap-2">
            <Button variant="secondary" size="icon" aria-label="Invite people" onClick={() => shareInvite(group)}>
              <UserPlus className="size-5" />
            </Button>
            <Button
              variant="secondary"
              size="icon"
              aria-label="Members and settings"
              onClick={() => setSettingsOpen(true)}
            >
              <Settings2 className="size-5" />
            </Button>
          </div>
        }
      />

      <div className="-mt-2 mb-4 flex items-center gap-1 px-1">
        {active.slice(0, 6).map((m) => (
          <MemberAvatar
            key={m.id}
            id={m.id}
            name={m.display_name}
            className="-ml-1 size-7 text-[11px] ring-2 ring-bg first:ml-0"
          />
        ))}
        <span className="ml-2 text-sm text-muted">
          {active.length} {active.length === 1 ? "person" : "people"}
        </span>
      </div>

      <Card className="p-5">
        <p className={cn("text-2xl font-semibold tracking-tight tabular-nums", mine.tone)}>{mine.text}</p>
        {myTransfers.length > 0 && (
          <ul className="mt-3 space-y-2">
            {myTransfers.map((t) => (
              <li key={`${t.from}-${t.to}`} className="flex items-center gap-2 text-[15px]">
                <span className="min-w-0 flex-1 text-muted">
                  {t.from === me.id ? (
                    <>
                      You owe <span className="font-medium text-ink">{memberName(byId.get(t.to), me.id)}</span>
                    </>
                  ) : (
                    <>
                      <span className="font-medium text-ink">{memberName(byId.get(t.from), me.id)}</span> owes you
                    </>
                  )}
                </span>
                <span className="font-semibold tabular-nums">{formatMoney(t.amount, currency)}</span>
                <Button size="sm" variant={t.from === me.id ? "primary" : "secondary"} onClick={() => setSettling(t)}>
                  Settle
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div role="tablist" className="mt-6 grid grid-cols-2 gap-1 rounded-2xl bg-surface-2 p-1">
        {(["expenses", "balances"] as const).map((option) => (
          <button
            key={option}
            role="tab"
            aria-selected={tab === option}
            onClick={() => setTab(option)}
            className={cn(
              "h-10 rounded-xl text-sm font-medium capitalize",
              tab === option ? "bg-surface text-ink shadow-sm" : "text-muted",
            )}
          >
            {option}
          </button>
        ))}
      </div>

      {tab === "expenses" ? (
        timeline.length === 0 ? (
          <EmptyState
            emoji="🧾"
            title="No expenses yet"
            description="Add the first one: who paid, and how to split it."
            action={<Button onClick={openAdd}>Add expense</Button>}
          />
        ) : (
          <div className="mt-5 space-y-5">
            {days.map((day) => (
              <section key={day}>
                <h3 className="mb-1 px-1 text-sm font-medium text-muted">{relativeDayLabel(day)}</h3>
                <ul className="space-y-0.5">
                  {timeline
                    .filter((t) => t.day === day)
                    .map((item) =>
                      item.kind === "expense" ? (
                        <ExpenseItem
                          key={item.expense.id}
                          expense={item.expense}
                          meId={me.id}
                          payer={memberName(byId.get(item.expense.paid_by_member_id), me.id)}
                          payerName={byId.get(item.expense.paid_by_member_id)?.display_name ?? "?"}
                          onOpen={() =>
                            setEditing((s) => ({ open: true, expense: item.expense, version: s.version + 1 }))
                          }
                        />
                      ) : (
                        <li key={item.settlement.id} className="flex items-center gap-3 px-1 py-2.5 text-[15px]">
                          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-surface-2 text-xl">
                            💸
                          </span>
                          <span className="min-w-0 flex-1 text-muted">
                            <span className="font-medium text-ink">
                              {memberName(byId.get(item.settlement.from_member_id), me.id)}
                            </span>{" "}
                            paid{" "}
                            <span className="font-medium text-ink">
                              {memberName(byId.get(item.settlement.to_member_id), me.id)}
                            </span>
                          </span>
                          <span className="shrink-0 font-semibold tabular-nums">
                            {formatMoney(item.settlement.amount_minor, currency)}
                          </span>
                        </li>
                      ),
                    )}
                </ul>
              </section>
            ))}
          </div>
        )
      ) : (
        <div className="mt-5 space-y-6">
          <ul className="divide-y divide-line rounded-card border border-line bg-surface">
            {active.map((m) => {
              const net = balances.get(m.id) ?? 0;
              return (
                <li key={m.id} className="flex items-center gap-3 px-4 py-3">
                  <MemberAvatar id={m.id} name={m.display_name} />
                  <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{memberName(m, me.id)}</span>
                  <span
                    className={cn(
                      "text-sm tabular-nums",
                      net > 0 ? "text-success" : net < 0 ? "text-ink" : "text-muted",
                    )}
                  >
                    {net > 0
                      ? `${m.id === me.id ? "get" : "gets"} back ${formatMoney(net, currency)}`
                      : net < 0
                        ? `${m.id === me.id ? "owe" : "owes"} ${formatMoney(-net, currency)}`
                        : "settled up"}
                  </span>
                </li>
              );
            })}
          </ul>
          <section>
            <h3 className="mb-2 px-1 text-sm font-semibold tracking-wide text-muted uppercase">Suggested payments</h3>
            {transfers.length === 0 ? (
              <p className="px-1 text-[15px] text-muted">Everyone is settled up. 🎉</p>
            ) : (
              <ul className="space-y-2">
                {transfers.map((t) => (
                  <li
                    key={`${t.from}-${t.to}`}
                    className="flex items-center gap-2 rounded-2xl border border-line bg-surface px-3 py-2.5 text-[15px]"
                  >
                    <span className="truncate font-medium">{memberName(byId.get(t.from), me.id)}</span>
                    <ArrowRight className="size-4 shrink-0 text-subtle" aria-label="pays" />
                    <span className="min-w-0 flex-1 truncate font-medium">{memberName(byId.get(t.to), me.id)}</span>
                    <span className="font-semibold tabular-nums">{formatMoney(t.amount, currency)}</span>
                    <Button size="sm" variant="secondary" onClick={() => setSettling(t)}>
                      Record
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 px-1 text-sm text-subtle">The fewest payments that settle everyone.</p>
          </section>
        </div>
      )}

      <button
        type="button"
        onClick={openAdd}
        aria-label="Add group expense"
        className={cn(
          "fixed right-5 z-30 grid size-15 place-items-center rounded-full bg-ink text-bg shadow-xl shadow-black/20 transition duration-300 active:scale-90 min-[560px]:right-[calc(50%-15rem)]",
          fabHidden && "pointer-events-none translate-y-24 opacity-0",
        )}
        style={{ bottom: "calc(env(safe-area-inset-bottom) + 4rem + 1rem)" }}
      >
        <Plus className="size-7" strokeWidth={2.25} />
      </button>

      <Sheet
        open={editing.open}
        onOpenChange={(open) => setEditing((s) => ({ ...s, open }))}
        title={editing.expense ? "Edit expense" : "Add group expense"}
      >
        <GroupExpenseForm
          key={editing.version}
          group={group}
          members={[me, ...active.filter((m) => m.id !== me.id)]}
          me={me}
          expense={editing.expense}
          onDone={() => setEditing((s) => ({ ...s, open: false }))}
        />
      </Sheet>
      <SettleSheet
        open={settling !== null}
        onOpenChange={(open) => !open && setSettling(null)}
        group={group}
        members={members}
        me={me}
        transfer={settling}
      />
      <GroupSettingsSheet
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        group={group}
        members={active}
        me={me}
        myBalance={myBalance}
      />
      <Sheet
        open={invitePrompt}
        onOpenChange={setInvitePrompt}
        title="Invite your friends"
        description="Send the link so they can add expenses too. Friends you added by name can claim their spot when they join."
      >
        <div className="space-y-3">
          <Button size="lg" className="w-full" onClick={() => shareInvite(group).then(() => setInvitePrompt(false))}>
            Share invite link
          </Button>
          <Button size="lg" variant="secondary" className="w-full" onClick={() => setInvitePrompt(false)}>
            Later
          </Button>
        </div>
      </Sheet>
    </>
  );
}

function ExpenseItem({
  expense,
  meId,
  payer,
  payerName,
  onOpen,
}: {
  expense: GroupExpense;
  meId: string;
  payer: string;
  payerName: string;
  onOpen: () => void;
}) {
  const myShare = (expense.splits as Split[]).find((s) => s.member_id === meId)?.share_minor ?? 0;
  const iPaid = expense.paid_by_member_id === meId;
  const lent = iPaid ? expense.amount_minor - myShare : 0;
  let right: { text: string; tone: string };
  if (iPaid && lent > 0) right = { text: `you lent ${formatMoney(lent, expense.currency)}`, tone: "text-success" };
  else if (!iPaid && myShare > 0)
    right = { text: `you owe ${formatMoney(myShare, expense.currency)}`, tone: "text-ink" };
  else if (iPaid) right = { text: "just you", tone: "text-muted" };
  else right = { text: "not involved", tone: "text-subtle" };

  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-center gap-3 px-1 py-2.5 text-left transition active:bg-surface-2"
      >
        <MemberAvatar id={expense.paid_by_member_id} name={payerName} className="size-11 text-base" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-medium">{expense.description}</span>
          <span className="block truncate text-sm text-muted">
            {payer} paid {formatMoney(expense.amount_minor, expense.currency)}
          </span>
        </span>
        <span className={cn("shrink-0 text-sm font-medium tabular-nums", right.tone)}>{right.text}</span>
      </button>
    </li>
  );
}
