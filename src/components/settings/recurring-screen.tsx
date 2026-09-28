"use client";

import { useState } from "react";
import { toast } from "sonner";
import { BackHeader } from "@/components/app/back-header";
import { useData } from "@/components/data/data-provider";
import { CategoryBadge } from "@/components/expenses/category-chip";
import { AmountInput, parseAmount } from "@/components/ui/amount-input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Label } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { relativeDayLabel } from "@/lib/dates";
import { kindOf, type RecurringRule } from "@/lib/db/local";
import { deleteRecurringRule, updateRecurringRule } from "@/lib/db/mutations";
import { useCategoryMap, useProfile, useRecurringRules } from "@/lib/db/queries";
import { formatMoney, fromMinor, roundToWhole, toMinor } from "@/lib/money";
import { describeFrequency, monthlyCost, type Frequency } from "@/lib/recurrence";
import { cn } from "@/lib/utils";

export function RecurringScreen() {
  const rules = useRecurringRules();
  const categories = useCategoryMap();
  const profile = useProfile();
  const [editing, setEditing] = useState<{ open: boolean; rule: RecurringRule | null }>({ open: false, rule: null });
  const currency = profile?.currency ?? "INR";

  const active = (rules ?? []).filter((r) => r.is_active);
  const paused = (rules ?? []).filter((r) => !r.is_active);
  const monthly = (kind: string) =>
    roundToWhole(
      active.filter((r) => kindOf(r) === kind).reduce((sum, r) => sum + monthlyCost(r), 0),
      currency,
    );

  const row = (rule: RecurringRule) => {
    const category = categories.get(rule.category_id);
    return (
      <li key={rule.id}>
        <button
          type="button"
          onClick={() => setEditing({ open: true, rule })}
          className="flex w-full items-center gap-3 px-4 py-3 text-left transition active:bg-surface-2"
        >
          <CategoryBadge category={category} className={cn("size-10 text-lg", !rule.is_active && "opacity-50")} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-medium">{rule.note || category?.name}</span>
            <span className="block truncate text-sm text-muted">
              {describeFrequency(rule.frequency, rule.interval)}
              {rule.is_active ? ` · next ${relativeDayLabel(rule.next_due_on)}` : " · paused"}
              {rule.mode === "ask" && rule.is_active ? " · asks first" : ""}
            </span>
          </span>
          <span
            className={cn(
              "shrink-0 text-[15px] font-semibold tabular-nums",
              kindOf(rule) === "income" && "text-success",
            )}
          >
            {kindOf(rule) === "income" && "+"}
            {formatMoney(rule.amount_minor, rule.currency)}
          </span>
        </button>
      </li>
    );
  };

  return (
    <>
      <BackHeader href="/settings" backLabel="Settings" title="Recurring" />

      {rules?.length === 0 ? (
        <EmptyState
          emoji="🔁"
          title="No recurring bills yet"
          description="When adding an expense like rent or Netflix, tap Repeat. It'll be added automatically each time."
        />
      ) : (
        <>
          <Card className="mb-6">
            <p className="text-sm font-medium text-muted">Bills & subscriptions</p>
            <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">
              {formatMoney(monthly("expense"), currency)}
              <span className="ml-1 text-base font-medium tracking-normal text-muted">/month</span>
            </p>
            {monthly("income") > 0 && (
              <p className="mt-2 text-sm text-muted">
                Recurring income{" "}
                <span className="font-medium text-success">{formatMoney(monthly("income"), currency)}</span>/month
              </p>
            )}
          </Card>
          {active.length > 0 && (
            <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
              {active.map(row)}
            </ul>
          )}
          {paused.length > 0 && (
            <>
              <h2 className="mt-7 mb-2 px-1 text-sm font-semibold tracking-wide text-muted uppercase">Paused</h2>
              <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
                {paused.map(row)}
              </ul>
            </>
          )}
        </>
      )}

      <Sheet open={editing.open} onOpenChange={(open) => setEditing((s) => ({ ...s, open }))} title="Edit recurring">
        {editing.rule && (
          <RuleForm
            key={editing.rule.id}
            rule={editing.rule}
            onDone={() => setEditing((s) => ({ ...s, open: false }))}
          />
        )}
      </Sheet>
    </>
  );
}

const FREQUENCIES: Frequency[] = ["weekly", "monthly", "yearly"];

function RuleForm({ rule, onDone }: { rule: RecurringRule; onDone: () => void }) {
  const { db } = useData();
  const [frequency, setFrequency] = useState(rule.frequency as Frequency);
  const [ask, setAsk] = useState(rule.mode === "ask");
  const [activeRule, setActiveRule] = useState(rule.is_active);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const amount = parseAmount(String(form.get("amount") ?? ""));
    if (amount === null) return toast.error("Enter an amount above zero.");
    await updateRecurringRule(db, rule, {
      amount_minor: toMinor(amount, rule.currency),
      note: String(form.get("note") ?? ""),
      ...(frequency !== rule.frequency ? { frequency, interval: 1 } : {}),
      mode: ask ? "ask" : "auto",
      is_active: activeRule,
    });
    toast.success("Saved. Applies from the next one.");
    onDone();
  }

  async function stop() {
    await deleteRecurringRule(db, rule);
    toast("Stopped repeating. Past entries are kept.");
    onDone();
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <div>
        <Label htmlFor="rule-amount">Amount</Label>
        <AmountInput
          id="rule-amount"
          name="amount"
          currency={rule.currency}
          defaultValue={String(fromMinor(rule.amount_minor, rule.currency))}
        />
      </div>
      <div>
        <Label htmlFor="rule-note">Name</Label>
        <Input id="rule-note" name="note" defaultValue={rule.note ?? ""} placeholder="e.g. Netflix" maxLength={500} />
      </div>
      <div>
        <Label>Repeats</Label>
        <div className="flex gap-2">
          {FREQUENCIES.map((option) => (
            <Chip key={option} type="button" selected={frequency === option} onClick={() => setFrequency(option)}>
              {describeFrequency(option)}
            </Chip>
          ))}
        </div>
      </div>
      <div className="divide-y divide-line rounded-2xl bg-surface-2">
        <label className="flex items-center justify-between gap-3 px-4 py-3">
          <span>
            <span className="block text-[15px] font-medium">Ask before adding</span>
            <span className="block text-sm text-muted">Confirm each one on Home, e.g. a varying bill</span>
          </span>
          <Switch label="Ask before adding" checked={ask} onChange={setAsk} />
        </label>
        <label className="flex items-center justify-between gap-3 px-4 py-3">
          <span>
            <span className="block text-[15px] font-medium">Active</span>
            <span className="block text-sm text-muted">Pause to skip it for now</span>
          </span>
          <Switch label="Active" checked={activeRule} onChange={setActiveRule} />
        </label>
      </div>
      <Button type="submit" size="lg" className="w-full">
        Save
      </Button>
      <Button type="button" variant="danger" size="lg" className="w-full" onClick={stop}>
        Stop repeating
      </Button>
    </form>
  );
}
