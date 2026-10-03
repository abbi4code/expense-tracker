"use client";

import {
  Briefcase,
  CalendarDays,
  Camera,
  ClipboardPaste,
  Copy,
  PenLine,
  Repeat,
  Star,
  Trash2,
  Wallet,
} from "lucide-react";
import { motion, useAnimationControls } from "motion/react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useData } from "@/components/data/data-provider";
import { Input } from "@/components/ui/input";
import { evaluate, hasOperator, pressKey } from "@/lib/amount-expression";
import { guessCurrency } from "@/lib/currencies";
import { addDays, relativeDayLabel, todayISO } from "@/lib/dates";
import { kindOf, type Expense, type Kind } from "@/lib/db/local";
import {
  addFavourite,
  createCategory,
  createExpense,
  createRecurringExpense,
  deleteExpense,
  removeFavourite,
  setReimbursed,
  updateExpense,
} from "@/lib/db/mutations";
import {
  useCategories,
  useCategoryUsage,
  useFavourites,
  useNoteSuggestions,
  usePaymentMethods,
  useProfile,
  useRecentExpenses,
} from "@/lib/db/queries";
import { currencySymbol, formatMoney, formatPlain, fractionDigits, fromMinor, toMinor } from "@/lib/money";
import { deleteReceipt, receiptUrl, uploadReceipt } from "@/lib/receipts";
import { describeFrequency, type Frequency } from "@/lib/recurrence";
import { extractTags } from "@/lib/tags";
import { guessEmoji, leastUsedColor } from "@/lib/category-colors";
import { favouriteKey } from "@/lib/favourites";
import { useQuickEntryParser } from "@/lib/use-quick-entry";
import { cn } from "@/lib/utils";
import { CategoryPicker, CategoryQuickRow } from "./category-picker";
import { NumberPad } from "./number-pad";
import { useExpenseActions } from "./use-expense-actions";

type Panel = "date" | "payment" | "note" | "repeat" | "receipt" | "paste" | null;

const REPEAT_OPTIONS: Frequency[] = ["weekly", "monthly", "yearly"];

/** Starting values for a new expense (quick entry, shared text). */
export type ExpensePrefill = {
  amount?: number | null;
  note?: string;
  categoryId?: string | null;
  paymentMethodId?: string | null;
  spentOn?: string;
};

type ExpenseFormProps = {
  /** Editing an existing expense; null to add a new one. */
  expense: Expense | null;
  prefill?: ExpensePrefill;
  onDone: () => void;
};

export function ExpenseForm({ expense, prefill, onDone }: ExpenseFormProps) {
  const { db } = useData();
  const profile = useProfile();
  const [kind, setKind] = useState<Kind>(expense ? kindOf(expense) : "expense");
  const categories = useCategories(kind);
  const usage = useCategoryUsage();
  const paymentMethods = usePaymentMethods();
  const noteSuggestions = useNoteSuggestions();
  const lastExpense = useRecentExpenses(1)?.[0];
  const actions = useExpenseActions();
  const shake = useAnimationControls();
  const { parseShared } = useQuickEntryParser();
  const favourites = useFavourites();

  const currency = expense?.currency ?? profile?.currency ?? guessCurrency();
  const decimals = fractionDigits(currency);

  const [expression, setExpression] = useState(() =>
    expense ? String(fromMinor(expense.amount_minor, expense.currency)) : prefill?.amount ? String(prefill.amount) : "",
  );
  // `undefined` = not chosen yet → fall back to a smart default below.
  const [categoryId, setCategoryId] = useState<string | undefined>(
    expense?.category_id ?? prefill?.categoryId ?? undefined,
  );
  const [paymentMethodId, setPaymentMethodId] = useState<string | null | undefined>(
    expense ? expense.payment_method_id : (prefill?.paymentMethodId ?? undefined),
  );
  const [note, setNote] = useState(expense?.note ?? prefill?.note ?? "");
  const [spentOn, setSpentOn] = useState(expense?.spent_on ?? prefill?.spentOn ?? todayISO());
  const [reimbursable, setReimbursable] = useState(expense?.reimbursable ?? false);
  // A newly picked photo, or "remove" to drop the existing one.
  const [receipt, setReceipt] = useState<File | "remove" | null>(null);
  const [existingReceiptUrl, setExistingReceiptUrl] = useState<string | null>(null);
  const receiptPreview = useMemo(() => (receipt instanceof File ? URL.createObjectURL(receipt) : null), [receipt]);
  const receiptThumb = receipt === "remove" ? null : (receiptPreview ?? existingReceiptUrl);
  const [repeat, setRepeat] = useState<Frequency | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [pickingCategory, setPickingCategory] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);

  // Chips: categories shown in the Add sheet, most used first.
  const chips = useMemo(() => {
    const visible = (categories ?? []).filter((c) => !c.is_archived || c.id === expense?.category_id);
    return visible.sort((a, b) => (usage?.get(b.id)?.count ?? 0) - (usage?.get(a.id)?.count ?? 0));
  }, [categories, usage, expense?.category_id]);

  const lastUsedCategoryId = useMemo(() => {
    let best: [string, string] | undefined;
    for (const [id, u] of usage ?? []) if (!best || u.lastUsed > best[1]) best = [id, u.lastUsed];
    return best && chips.some((c) => c.id === best[0]) ? best[0] : undefined;
  }, [usage, chips]);

  const suggestion = noteSuggestions?.get(note.trim().toLowerCase());
  const suggestedCategoryId = chips.some((c) => c.id === suggestion) ? suggestion : undefined;
  const selectedCategoryId = categoryId ?? suggestedCategoryId ?? lastUsedCategoryId ?? chips[0]?.id;
  const selectedCategory = chips.find((c) => c.id === selectedCategoryId);

  const showPayment = profile?.show_payment_method ?? true;
  const selectedPaymentId =
    paymentMethodId === undefined ? (showPayment ? (lastExpense?.payment_method_id ?? null) : null) : paymentMethodId;
  const selectedPayment = paymentMethods?.find((m) => m.id === selectedPaymentId);

  const amount = evaluate(expression);
  const amountMinor = toMinor(amount, currency);
  const valid = amountMinor > 0 && Boolean(selectedCategoryId);
  const favouriteDraft = {
    amount_minor: amountMinor,
    currency,
    category_id: selectedCategoryId ?? "",
    payment_method_id: selectedPaymentId ?? null,
    note: note.trim() || null,
  };
  const pinned = favourites?.find((f) => favouriteKey(f) === favouriteKey(favouriteDraft));

  async function save() {
    if (!valid || saving) {
      if (amountMinor <= 0) shake.start({ x: [0, -10, 10, -6, 6, 0], transition: { duration: 0.35 } });
      return;
    }
    setSaving(true);
    const input = {
      amount_minor: amountMinor,
      currency,
      category_id: selectedCategoryId!,
      payment_method_id: selectedPaymentId ?? null,
      note: note || null,
      spent_on: spentOn,
      kind,
      reimbursable: kind === "expense" && reimbursable,
    };
    let saved: Expense;
    if (expense) {
      await updateExpense(db, expense, input);
      saved = { ...expense, ...input };
      toast.success("Saved");
    } else if (repeat) {
      saved = await createRecurringExpense(db, { ...input, frequency: repeat });
      toast(`Added ${formatMoney(amountMinor, currency)} · repeats ${describeFrequency(repeat).toLowerCase()}`, {
        description: "Manage it in Settings → Recurring",
      });
    } else {
      const created = await createExpense(db, input);
      saved = created;
      toast(`Added ${formatMoney(amountMinor, currency)} · ${selectedCategory?.name ?? ""}`, {
        action: { label: "Undo", onClick: () => deleteExpense(db, created) },
      });
    }
    onDone();
    if (receipt) void saveReceipt(saved);
  }

  /** Uploads after the sheet closes; the expense is already saved either way. */
  async function saveReceipt(saved: Expense) {
    const current = (await db.expenses.get(saved.id)) ?? saved;
    try {
      if (current.receipt_path) await deleteReceipt(current.receipt_path).catch(() => {});
      const path = receipt instanceof File ? await uploadReceipt(db.userId, saved.id, receipt) : null;
      await updateExpense(db, current, { receipt_path: path });
    } catch {
      toast.error("The receipt photo couldn't be uploaded. Try again when you're online.");
    }
  }

  // Show the stored receipt when editing (needs the network; the thumbnail just stays blank offline).
  useEffect(() => {
    if (!expense?.receipt_path) return;
    let cancelled = false;
    receiptUrl(expense.receipt_path)
      .then((url) => !cancelled && setExistingReceiptUrl(url))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [expense?.receipt_path]);

  // Desktop: type straight into the pad; Enter saves.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.target instanceof HTMLInputElement || event.metaKey || event.ctrlKey) return;
      const key = event.key === "Backspace" ? "backspace" : event.key;
      if (/^[0-9.+-]$/.test(key) || key === "backspace") {
        event.preventDefault();
        setExpression((current) => pressKey(current, key, decimals));
      } else if (key === "Enter") {
        event.preventDefault();
        document.getElementById("expense-save")?.click();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [decimals]);

  const expressionLabel = expression
    .split(/([+-])/)
    .map((part) => (part === "+" ? " + " : part === "-" ? " − " : part && formatPlain(part)))
    .join("");
  const bigText = expression ? expressionLabel : "0";
  const baseSize = bigText.length <= 7 ? "3.5rem" : bigText.length <= 11 ? "2.75rem" : "2.1rem";
  const fontSize = `min(${baseSize}, 8.5dvh)`; // shrink on short screens so the pad always fits

  return (
    <div className="flex flex-col gap-3 [@media(min-height:700px)]:gap-4">
      <div className="flex min-h-8 items-center justify-between">
        {profile?.track_income ? (
          <div role="radiogroup" aria-label="Type" className="flex rounded-full bg-surface-2 p-1">
            {(["expense", "income"] as const).map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={kind === option}
                onClick={() => {
                  setKind(option);
                  setCategoryId(undefined);
                  setRepeat(null);
                }}
                className={cn(
                  "h-7 rounded-full px-3 text-sm font-semibold capitalize transition",
                  kind === option ? "bg-surface text-ink shadow-sm" : "text-muted",
                )}
              >
                {option}
              </button>
            ))}
          </div>
        ) : (
          <h2 className="text-lg font-semibold tracking-tight">{expense ? "Edit expense" : "Add expense"}</h2>
        )}
        {expense && (
          <div className="flex gap-1">
            <IconButton
              label="Duplicate for today"
              onClick={() => {
                actions.duplicate(expense);
                onDone();
              }}
            >
              <Copy className="size-5" />
            </IconButton>
            <IconButton
              label="Delete"
              className="text-danger"
              onClick={() => {
                actions.remove(expense);
                onDone();
              }}
            >
              <Trash2 className="size-5" />
            </IconButton>
          </div>
        )}
      </div>

      {/* Amount */}
      <motion.div animate={shake} className="flex flex-col items-center" aria-live="polite">
        <div
          className={cn(
            "flex max-w-full items-baseline gap-1 leading-none font-semibold tracking-tighter tabular-nums",
            !expression && "text-subtle",
          )}
          style={{ fontSize }}
        >
          <span className="text-[0.55em] text-muted">{currencySymbol(currency)}</span>
          <span className="truncate">{bigText}</span>
        </div>
        <p className="mt-1 h-5 text-sm text-muted tabular-nums">
          {hasOperator(expression) && `= ${formatMoney(amountMinor, currency)}`}
        </p>
      </motion.div>

      {pickingCategory ? (
        <CategoryPicker
          categories={chips}
          selectedId={selectedCategoryId}
          onSelect={(id) => {
            setCategoryId(id);
            setPickingCategory(false);
          }}
          onCreate={async (name) => {
            const created = await createCategory(db, {
              name,
              kind,
              emoji: guessEmoji(name),
              color: leastUsedColor(categories ?? []),
            });
            setCategoryId(created.id);
            setPickingCategory(false);
            toast.success(`Created ${created.emoji} ${created.name}`);
          }}
          onBack={() => setPickingCategory(false)}
          onManage={onDone}
        />
      ) : (
        <>
          <CategoryQuickRow
            categories={chips}
            selectedId={selectedCategoryId}
            onSelect={setCategoryId}
            onMore={() => {
              setPanel(null);
              setPickingCategory(true);
            }}
          />

          {/* Details */}
          <div>
            <div className="flex gap-2 overflow-x-auto no-scrollbar">
              {!expense && (
                <Pill
                  active={panel === "paste"}
                  aria-label="Paste a payment message"
                  onClick={() => (panel === "paste" ? setPanel(null) : pasteFromClipboard())}
                >
                  <ClipboardPaste className="size-4" />
                  Paste
                </Pill>
              )}
              <Pill active={panel === "date"} onClick={() => setPanel(panel === "date" ? null : "date")}>
                <CalendarDays className="size-4" />
                {relativeDayLabel(spentOn)}
              </Pill>
              {showPayment && (
                <Pill active={panel === "payment"} onClick={() => setPanel(panel === "payment" ? null : "payment")}>
                  <Wallet className="size-4" />
                  {selectedPayment?.name ?? "Payment"}
                </Pill>
              )}
              <Pill active={panel === "note"} onClick={() => setPanel(panel === "note" ? null : "note")}>
                <PenLine className="size-4" />
                <span className="max-w-32 truncate">{note || "Note"}</span>
              </Pill>
              {expense?.recurring_rule_id ? (
                <Link
                  href="/settings/recurring"
                  onClick={onDone}
                  className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-surface-2 px-3.5 text-sm font-medium"
                >
                  <Repeat className="size-4" />
                  Repeats · Manage
                </Link>
              ) : (
                !expense && (
                  <Pill active={panel === "repeat"} onClick={() => setPanel(panel === "repeat" ? null : "repeat")}>
                    <Repeat className="size-4" />
                    {repeat ? describeFrequency(repeat) : "Repeat"}
                  </Pill>
                )
              )}
              {kind === "expense" && (
                <Pill active={reimbursable} aria-pressed={reimbursable} onClick={() => setReimbursable((r) => !r)}>
                  <Briefcase className="size-4" />
                  {reimbursable ? "Work · claim back" : "Work expense"}
                </Pill>
              )}
              {expense && kind === "expense" && (
                <Pill active={Boolean(pinned)} aria-pressed={Boolean(pinned)} onClick={toggleFavourite}>
                  <Star className={cn("size-4", pinned && "fill-current")} />
                  Favourite
                </Pill>
              )}
              <Pill
                active={panel === "receipt"}
                onClick={() =>
                  receiptThumb ? setPanel(panel === "receipt" ? null : "receipt") : fileInput.current?.click()
                }
              >
                {receiptThumb ? (
                  // eslint-disable-next-line @next/next/no-img-element -- blob/signed URLs, not optimisable
                  <img src={receiptThumb} alt="" className="-ml-1.5 size-6 rounded-md object-cover" />
                ) : (
                  <Camera className="size-4" />
                )}
                Receipt
              </Pill>
              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) setReceipt(file);
                  e.target.value = "";
                }}
              />
            </div>

            {expense?.reimbursable && kind === "expense" && reimbursable && (
              <div className="mt-2 flex items-center justify-between gap-3 rounded-2xl bg-surface-2 px-4 py-2.5 text-sm">
                <span className="text-muted">
                  {expense.reimbursed_at ? "Paid back." : "Not counted in your spending until paid back."}
                </span>
                <button
                  type="button"
                  className="shrink-0 font-semibold text-ink"
                  onClick={() => {
                    setReimbursed(db, expense, !expense.reimbursed_at);
                    toast.success(expense.reimbursed_at ? "Marked as still owed" : "Marked as paid back");
                    onDone();
                  }}
                >
                  {expense.reimbursed_at ? "Undo" : "Mark paid back"}
                </button>
              </div>
            )}

            {panel === "receipt" && receiptThumb && (
              <div className="mt-2 flex items-center gap-3">
                <a href={receiptThumb} target="_blank" rel="noreferrer" className="shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element -- blob/signed URLs, not optimisable */}
                  <img
                    src={receiptThumb}
                    alt="Receipt"
                    className="size-20 rounded-xl border border-line object-cover"
                  />
                </a>
                <div className="flex flex-wrap gap-2">
                  <OptionChip selected={false} onClick={() => fileInput.current?.click()}>
                    Replace
                  </OptionChip>
                  <OptionChip
                    selected={false}
                    onClick={() => pick(() => setReceipt(expense?.receipt_path ? "remove" : null))}
                  >
                    Remove
                  </OptionChip>
                </div>
              </div>
            )}

            {panel === "date" && (
              <div className="mt-2 flex flex-wrap gap-2">
                <OptionChip selected={spentOn === todayISO()} onClick={() => pick(() => setSpentOn(todayISO()))}>
                  Today
                </OptionChip>
                <OptionChip
                  selected={spentOn === addDays(todayISO(), -1)}
                  onClick={() => pick(() => setSpentOn(addDays(todayISO(), -1)))}
                >
                  Yesterday
                </OptionChip>
                <label className="relative inline-flex h-9 items-center rounded-full border border-line bg-surface px-3.5 text-sm font-medium">
                  Pick a date…
                  <input
                    type="date"
                    aria-label="Pick a date"
                    value={spentOn}
                    max={todayISO()}
                    onChange={(e) => e.target.value && pick(() => setSpentOn(e.target.value))}
                    className="absolute inset-0 opacity-0"
                  />
                </label>
              </div>
            )}

            {panel === "payment" && (
              <div className="mt-2 flex flex-wrap gap-2">
                {paymentMethods?.map((method) => (
                  <OptionChip
                    key={method.id}
                    selected={method.id === selectedPaymentId}
                    onClick={() => pick(() => setPaymentMethodId(method.id))}
                  >
                    {method.name}
                  </OptionChip>
                ))}
                <OptionChip selected={!selectedPaymentId} onClick={() => pick(() => setPaymentMethodId(null))}>
                  None
                </OptionChip>
              </div>
            )}

            {panel === "paste" && (
              <Input
                autoFocus
                className="mt-2 h-12"
                aria-label="Payment message"
                placeholder="Paste the payment SMS here"
                enterKeyHint="done"
                onPaste={(e) => {
                  e.preventDefault();
                  fillFromMessage(e.clipboardData.getData("text"));
                }}
                onKeyDown={(e) => e.key === "Enter" && fillFromMessage(e.currentTarget.value)}
              />
            )}
            {panel === "paste" && (
              <p className="mt-1.5 px-1 text-sm text-subtle">Long-press the box and choose Paste.</p>
            )}

            {panel === "note" && (
              <Input
                autoFocus
                className="mt-2 h-12"
                placeholder="What was it for?"
                value={note}
                maxLength={500}
                enterKeyHint="done"
                onChange={(e) => setNote(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.currentTarget.blur(), setPanel(null))}
              />
            )}
            {panel === "note" && (
              <p className="mt-1.5 truncate px-1 text-sm text-subtle">
                {extractTags(note).length
                  ? extractTags(note)
                      .map((tag) => `#${tag}`)
                      .join("  ")
                  : "Tip: add #tags, like #goa-trip"}
              </p>
            )}

            {panel === "repeat" && (
              <div className="mt-2 flex flex-wrap gap-2">
                <OptionChip selected={!repeat} onClick={() => pick(() => setRepeat(null))}>
                  Doesn&apos;t repeat
                </OptionChip>
                {REPEAT_OPTIONS.map((option) => (
                  <OptionChip key={option} selected={repeat === option} onClick={() => pick(() => setRepeat(option))}>
                    {describeFrequency(option)}
                  </OptionChip>
                ))}
              </div>
            )}
          </div>

          {/* Pasting needs the (system) keyboard, not the pad; it comes back once the message fills in. */}
          {panel !== "paste" && (
            <NumberPad
              onKey={(key) => setExpression((current) => pressKey(current, key, decimals))}
              onSave={save}
              saveLabel={expense ? "Save" : kind === "income" ? "Add income" : "Add"}
              saveDisabled={saving || !selectedCategoryId}
              allowDecimal={decimals > 0}
            />
          )}
        </>
      )}
      <button id="expense-save" type="button" hidden onClick={save} />
    </div>
  );

  function pick(apply: () => void) {
    apply();
    setPanel(null);
  }

  /** Pins this spend to Home (one tap to log it again), or unpins it. */
  async function toggleFavourite() {
    if (pinned) {
      await removeFavourite(db, pinned);
      return toast("Removed from favourites");
    }
    if (!valid) return toast.error("Enter an amount first.");
    await addFavourite(db, favouriteDraft);
    toast.success("Pinned to Home. Tap it there to log it again.");
  }

  /** Reads the clipboard; where the browser won't allow it, shows a box to paste into instead. */
  async function pasteFromClipboard() {
    const text = await navigator.clipboard?.readText().catch(() => "");
    if (text?.trim()) fillFromMessage(text);
    else setPanel("paste");
  }

  /** Fills the sheet from a bank SMS / UPI confirmation. */
  function fillFromMessage(text: string) {
    const draft = parseShared(text);
    if (!draft.amount) return toast.error("Couldn't find an amount in that message.");
    if (draft.credit && !profile?.track_income) return toast.error("That message is money received, not spent.");
    setExpression(String(draft.amount));
    setSpentOn(draft.spentOn);
    if (draft.note) setNote(draft.note);
    if (draft.paymentMethodId) setPaymentMethodId(draft.paymentMethodId);
    if (draft.credit) {
      setKind("income");
      setCategoryId(undefined);
      setRepeat(null);
    } else if (draft.categoryId) setCategoryId(draft.categoryId);
    setPanel(null);
    toast.success(draft.credit ? "Filled in as income" : "Filled from your message");
  }
}

function Pill({ active, children, ...props }: React.ComponentProps<"button"> & { active: boolean }) {
  return (
    <button
      type="button"
      aria-expanded={active}
      className={cn(
        "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium transition active:scale-95",
        active ? "bg-ink text-bg" : "bg-surface-2 text-ink",
      )}
      {...props}
    >
      {children}
    </button>
  );
}

function OptionChip({ selected, ...props }: React.ComponentProps<"button"> & { selected: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        "inline-flex h-9 items-center rounded-full border px-3.5 text-sm font-medium transition active:scale-95",
        selected ? "border-ink bg-ink text-bg" : "border-line bg-surface text-ink",
      )}
      {...props}
    />
  );
}

function IconButton({ label, className, ...props }: React.ComponentProps<"button"> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn("grid size-9 place-items-center rounded-full bg-surface-2 transition active:scale-90", className)}
      {...props}
    />
  );
}
