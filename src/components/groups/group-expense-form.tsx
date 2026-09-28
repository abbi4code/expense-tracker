"use client";

import { Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useData } from "@/components/data/data-provider";
import { AmountInput, parseAmount } from "@/components/ui/amount-input";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { addDays, todayISO } from "@/lib/dates";
import type { Group, GroupExpense, GroupMember } from "@/lib/db/local";
import { deleteGroupExpense, saveGroupExpense } from "@/lib/db/mutations";
import { formatMoney, fromMinor, toMinor } from "@/lib/money";
import { computeSplits, type Split, type SplitMode } from "@/lib/splits";
import { cn } from "@/lib/utils";
import { MemberAvatar } from "./member-avatar";

const MODES: { mode: SplitMode; label: string }[] = [
  { mode: "equal", label: "Equally" },
  { mode: "exact", label: "Exact" },
  { mode: "percent", label: "%" },
  { mode: "shares", label: "Shares" },
];

type GroupExpenseFormProps = {
  group: Group;
  members: GroupMember[];
  me: GroupMember;
  expense: GroupExpense | null;
  onDone: () => void;
};

/** Initial per-member inputs for each mode, from an existing expense when editing. */
function initialValues(expense: GroupExpense | null, members: GroupMember[], currency: string) {
  const splits = (expense?.splits as Split[] | undefined) ?? [];
  const byMember = new Map(splits.map((s) => [s.member_id, s]));
  const mode = (expense?.split_mode as SplitMode | undefined) ?? "equal";
  return Object.fromEntries(
    members.map((m) => {
      const s = byMember.get(m.id);
      if (!expense) return [m.id, "1"];
      if (mode === "equal") return [m.id, s ? "1" : "0"];
      if (mode === "exact") return [m.id, s ? String(fromMinor(s.share_minor, currency)) : ""];
      return [m.id, s?.weight !== undefined ? String(s.weight) : ""];
    }),
  );
}

export function GroupExpenseForm({ group, members, me, expense, onDone }: GroupExpenseFormProps) {
  const { db } = useData();
  const currency = expense?.currency ?? group.currency;
  const [description, setDescription] = useState(expense?.description ?? "");
  const [amountText, setAmountText] = useState(expense ? String(fromMinor(expense.amount_minor, currency)) : "");
  const [paidBy, setPaidBy] = useState(expense?.paid_by_member_id ?? me.id);
  const [mode, setMode] = useState<SplitMode>((expense?.split_mode as SplitMode) ?? "equal");
  const [values, setValues] = useState<Record<string, string>>(() => initialValues(expense, members, currency));
  const [spentOn, setSpentOn] = useState(expense?.spent_on ?? todayISO());

  const amountMinor = toMinor(parseAmount(amountText) ?? 0, currency);

  function switchMode(next: SplitMode) {
    setMode(next);
    // Sensible starting values: everyone in, even percentages, 1 share each, empty exact amounts.
    setValues(
      Object.fromEntries(
        members.map((m) => [
          m.id,
          next === "equal" || next === "shares"
            ? "1"
            : next === "percent"
              ? String(Math.round((100 / members.length) * 100) / 100)
              : "",
        ]),
      ),
    );
  }

  const result = useMemo(
    () =>
      computeSplits(
        amountMinor,
        mode,
        members.map((m) => {
          const raw = Number((values[m.id] ?? "").replace(/,/g, "")) || 0;
          return { member_id: m.id, value: mode === "exact" ? toMinor(raw, currency) : raw };
        }),
      ),
    [amountMinor, mode, members, values, currency],
  );
  const shareOf = new Map((result.splits ?? []).map((s) => [s.member_id, s.share_minor]));

  let hint: { text: string; problem: boolean };
  if (!amountMinor) hint = { text: "Enter the total amount", problem: true };
  else if (result.splits === null)
    hint = {
      text:
        result.difference !== undefined
          ? `${formatMoney(Math.abs(result.difference), currency)} ${result.problem}`
          : result.problem,
      problem: true,
    };
  else hint = { text: "Adds up", problem: false };

  async function save() {
    if (!description.trim()) return toast.error("What was it for?");
    if (!result.splits || !amountMinor) return toast.error(hint.text);
    const saved = await saveGroupExpense(
      db,
      {
        group_id: group.id,
        paid_by_member_id: paidBy,
        amount_minor: amountMinor,
        currency,
        description,
        spent_on: spentOn,
        split_mode: mode,
        splits: result.splits,
      },
      expense ?? undefined,
    );
    onDone();
    if (expense) toast.success("Saved");
    else
      toast(`Added ${formatMoney(amountMinor, currency)} · ${description.trim()}`, {
        action: { label: "Undo", onClick: () => deleteGroupExpense(db, saved) },
      });
  }

  async function remove() {
    if (!expense) return;
    await deleteGroupExpense(db, expense);
    onDone();
    toast("Expense deleted", { action: { label: "Undo", onClick: () => deleteGroupExpense(db, expense, false) } });
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-[1fr_auto] items-end gap-3">
        <div>
          <Label htmlFor="ge-description">What for?</Label>
          <Input
            id="ge-description"
            value={description}
            maxLength={200}
            placeholder="Dinner, cab, groceries…"
            autoFocus={!expense}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        {expense && (
          <button
            type="button"
            aria-label="Delete expense"
            onClick={remove}
            className="grid size-13 place-items-center rounded-2xl bg-danger/10 text-danger"
          >
            <Trash2 className="size-5" />
          </button>
        )}
      </div>

      <div>
        <Label htmlFor="ge-amount">Total</Label>
        <AmountInput
          id="ge-amount"
          currency={currency}
          value={amountText}
          onChange={(e) => setAmountText(e.target.value)}
        />
      </div>

      <div>
        <Label>Paid by</Label>
        <div className="-mx-6 flex gap-2 overflow-x-auto px-6 no-scrollbar">
          {members.map((m) => (
            <button
              key={m.id}
              type="button"
              aria-pressed={paidBy === m.id}
              onClick={() => setPaidBy(m.id)}
              className={cn(
                "inline-flex h-10 shrink-0 items-center gap-2 rounded-full border pr-3.5 pl-1 text-sm font-medium",
                paidBy === m.id ? "border-ink bg-ink text-bg" : "border-line bg-surface",
              )}
            >
              <MemberAvatar id={m.id} name={m.display_name} className="size-8 text-xs" />
              {m.id === me.id ? "You" : m.display_name}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <Label className="mb-0">Split</Label>
          <div role="radiogroup" aria-label="Split method" className="flex rounded-full bg-surface-2 p-1">
            {MODES.map(({ mode: option, label }) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={mode === option}
                onClick={() => switchMode(option)}
                className={cn(
                  "h-7 rounded-full px-3 text-sm font-semibold",
                  mode === option ? "bg-surface text-ink shadow-sm" : "text-muted",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
          {members.map((m) => {
            const included = mode !== "equal" || values[m.id] === "1";
            return (
              <li key={m.id} className="flex items-center gap-3 px-3 py-2">
                <MemberAvatar id={m.id} name={m.display_name} className="size-8 text-xs" />
                <span className="min-w-0 flex-1 truncate text-[15px]">{m.id === me.id ? "You" : m.display_name}</span>
                {mode === "equal" ? (
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={included}
                    aria-label={`Include ${m.display_name}`}
                    onClick={() => setValues((v) => ({ ...v, [m.id]: included ? "0" : "1" }))}
                    className={cn(
                      "h-8 rounded-full px-3 text-sm font-medium",
                      included ? "bg-ink text-bg" : "bg-surface-2 text-muted",
                    )}
                  >
                    {included ? formatMoney(shareOf.get(m.id) ?? 0, currency) : "Not in"}
                  </button>
                ) : (
                  <>
                    {mode !== "exact" && (
                      <span className="w-20 text-right text-sm text-muted tabular-nums">
                        {formatMoney(shareOf.get(m.id) ?? 0, currency)}
                      </span>
                    )}
                    <input
                      inputMode="decimal"
                      aria-label={`${m.display_name} ${mode === "exact" ? "amount" : mode === "percent" ? "percent" : "shares"}`}
                      value={values[m.id] ?? ""}
                      placeholder="0"
                      onChange={(e) => setValues((v) => ({ ...v, [m.id]: e.target.value }))}
                      className="h-9 w-20 rounded-lg border border-line bg-bg px-2 text-right text-base tabular-nums"
                    />
                    {mode === "percent" && <span className="text-sm text-muted">%</span>}
                  </>
                )}
              </li>
            );
          })}
        </ul>
        <p className={cn("mt-2 px-1 text-sm", hint.problem ? "text-danger" : "text-success")} aria-live="polite">
          {hint.problem ? hint.text : `✓ ${hint.text}`}
        </p>
      </div>

      <div className="flex gap-2">
        {[
          { label: "Today", value: todayISO() },
          { label: "Yesterday", value: addDays(todayISO(), -1) },
        ].map(({ label, value }) => (
          <button
            key={label}
            type="button"
            aria-pressed={spentOn === value}
            onClick={() => setSpentOn(value)}
            className={cn(
              "h-9 rounded-full border px-3.5 text-sm font-medium",
              spentOn === value ? "border-ink bg-ink text-bg" : "border-line bg-surface",
            )}
          >
            {label}
          </button>
        ))}
        <label className="relative inline-flex h-9 items-center rounded-full border border-line bg-surface px-3.5 text-sm font-medium">
          {spentOn !== todayISO() && spentOn !== addDays(todayISO(), -1) ? spentOn : "Other date…"}
          <input
            type="date"
            aria-label="Pick a date"
            value={spentOn}
            max={todayISO()}
            onChange={(e) => e.target.value && setSpentOn(e.target.value)}
            className="absolute inset-0 opacity-0"
          />
        </label>
      </div>

      <Button
        size="lg"
        className="w-full"
        onClick={save}
        disabled={!result.splits || !amountMinor || !description.trim()}
      >
        {expense ? "Save" : "Add expense"}
      </Button>
    </div>
  );
}
