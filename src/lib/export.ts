import { toCSV } from "./csv";
import { kindOf, type LocalDB } from "./db/local";
import { fromMinor } from "./money";

/** Saves a file: the share sheet on phones (so it can go to Drive, Mail…), a download elsewhere. */
export async function saveFile(name: string, type: string, content: string) {
  const file = new File([content], name, { type });
  if (navigator.canShare?.({ files: [file] }) && matchMedia("(pointer: coarse)").matches) {
    try {
      await navigator.share({ files: [file], title: name });
      return;
    } catch (error) {
      if ((error as Error).name === "AbortError") return;
    }
  }
  const url = URL.createObjectURL(file);
  const link = Object.assign(document.createElement("a"), { href: url, download: name });
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function exportCSV(db: LocalDB) {
  const [expenses, categories, methods] = await Promise.all([
    db.expenses.toArray(),
    db.categories.toArray(),
    db.payment_methods.toArray(),
  ]);
  const category = new Map(categories.map((c) => [c.id, c.name]));
  const method = new Map(methods.map((m) => [m.id, m.name]));
  const rows = expenses
    .filter((e) => !e.deleted_at)
    .sort((a, b) => a.spent_on.localeCompare(b.spent_on) || a.created_at.localeCompare(b.created_at))
    .map((e) => [
      e.spent_on,
      kindOf(e),
      fromMinor(e.amount_minor, e.currency),
      e.currency,
      category.get(e.category_id) ?? "",
      e.payment_method_id ? (method.get(e.payment_method_id) ?? "") : "",
      e.note ?? "",
      (e.tags ?? []).map((t) => `#${t}`).join(" "),
      e.reimbursable ? "yes" : "",
      e.reimbursed_at ? e.reimbursed_at.slice(0, 10) : "",
    ]);
  const header = [
    "Date",
    "Type",
    "Amount",
    "Currency",
    "Category",
    "Payment method",
    "Note",
    "Tags",
    "Work expense",
    "Paid back on",
  ];
  await saveFile(`expenses-${new Date().toISOString().slice(0, 10)}.csv`, "text/csv", "﻿" + toCSV([header, ...rows]));
  return rows.length;
}

export async function exportJSON(db: LocalDB) {
  const alive = <T extends { deleted_at?: string | null }>(rows: T[]) => rows.filter((r) => !r.deleted_at);
  const backup = {
    exported_at: new Date().toISOString(),
    profile: await db.profiles.get(db.userId),
    categories: alive(await db.categories.toArray()),
    payment_methods: alive(await db.payment_methods.toArray()),
    budgets: alive(await db.budgets.toArray()),
    recurring_rules: alive(await db.recurring_rules.toArray()),
    expenses: alive(await db.expenses.toArray()),
  };
  await saveFile(
    `expenses-backup-${backup.exported_at.slice(0, 10)}.json`,
    "application/json",
    JSON.stringify(backup, null, 2),
  );
}
