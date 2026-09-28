"use client";

import { FileDown, FileJson, FileUp } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { BackHeader } from "@/components/app/back-header";
import { useData } from "@/components/data/data-provider";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/input";
import { guessDateFormat, parseAmountCell, parseCSV, parseDateCell, type DateFormat } from "@/lib/csv";
import { importExpenses } from "@/lib/db/mutations";
import { useCategories, useProfile } from "@/lib/db/queries";
import { exportCSV, exportJSON } from "@/lib/export";
import { formatMoney, toMinor } from "@/lib/money";
import { useQuickEntryParser } from "@/lib/use-quick-entry";
import { SettingsGroup, SettingsRow } from "./settings-group";

type Mapping = { date: number; amount: number; note: number; category: number };

const guessColumn = (header: string[], names: RegExp) => header.findIndex((h) => names.test(h.trim().toLowerCase()));

export function DataScreen() {
  const { db } = useData();
  const profile = useProfile();
  const categories = useCategories();
  const { parse } = useQuickEntryParser();
  const fileInput = useRef<HTMLInputElement>(null);
  const [csv, setCsv] = useState<{ name: string; rows: string[][] } | null>(null);
  const [mapping, setMapping] = useState<Mapping>({ date: -1, amount: -1, note: -1, category: -1 });
  const [dateFormat, setDateFormat] = useState<DateFormat>("DD/MM/YYYY");
  const [importing, setImporting] = useState(false);
  const currency = profile?.currency ?? "INR";

  async function onFile(file: File) {
    const rows = parseCSV(await file.text());
    if (rows.length < 2) return toast.error("That file has no rows to import.");
    const header = rows[0];
    const next = {
      date: guessColumn(header, /date|day|when/),
      amount: guessColumn(header, /amount|debit|spent|value|price|withdrawal/),
      note: guessColumn(header, /note|description|narration|details|remarks|merchant|title/),
      category: guessColumn(header, /category|type of expense/),
    };
    setMapping(next);
    if (next.date >= 0) setDateFormat(guessDateFormat(rows.slice(1, 30).map((r) => r[next.date] ?? "")));
    setCsv({ name: file.name, rows });
  }

  // Parse every data row with the current mapping; drafts that can't be read are counted as skipped.
  const drafts = useMemo(() => {
    if (!csv || mapping.date < 0 || mapping.amount < 0 || !categories) return [];
    const byName = new Map(categories.map((c) => [c.name.toLowerCase(), c.id]));
    const fallback = categories.find((c) => c.name === "Other")?.id ?? categories[0]?.id;
    return csv.rows.slice(1).map((row) => {
      const date = parseDateCell(row[mapping.date] ?? "", dateFormat);
      const amount = parseAmountCell(row[mapping.amount] ?? "");
      const note = mapping.note >= 0 ? (row[mapping.note] ?? "").trim() : "";
      const categoryName = mapping.category >= 0 ? (row[mapping.category] ?? "").trim().toLowerCase() : "";
      const categoryId = byName.get(categoryName) ?? (note ? parse(note).categoryId : null) ?? fallback;
      return { date, amount, note, categoryId, ok: Boolean(date && amount && categoryId) };
    });
  }, [csv, mapping, dateFormat, categories, parse]);
  const valid = drafts.filter((d) => d.ok);

  async function runImport() {
    setImporting(true);
    const count = await importExpenses(
      db,
      valid.map((d) => ({
        amount_minor: toMinor(d.amount!, currency),
        currency,
        category_id: d.categoryId!,
        payment_method_id: null,
        note: d.note.slice(0, 500) || null,
        spent_on: d.date!,
      })),
    );
    setImporting(false);
    setCsv(null);
    toast.success(`Imported ${count} expenses`);
  }

  const header = csv?.rows[0] ?? [];
  const select = (key: keyof Mapping, label: string, optional = false) => (
    <div>
      <Label htmlFor={`map-${key}`}>{label}</Label>
      <select
        id={`map-${key}`}
        value={mapping[key]}
        onChange={(e) => setMapping((m) => ({ ...m, [key]: Number(e.target.value) }))}
        className="h-11 w-full rounded-xl border border-line bg-surface px-3 text-base"
      >
        <option value={-1}>{optional ? "None" : "Choose a column"}</option>
        {header.map((name, i) => (
          <option key={i} value={i}>
            {name || `Column ${i + 1}`}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <>
      <BackHeader href="/settings" backLabel="Settings" title="Export & import" />

      <SettingsGroup title="Export">
        <SettingsRow
          icon={<FileDown className="size-[18px]" />}
          label="Export CSV"
          hint="Opens in Excel, Sheets or Numbers"
          onClick={async () => toast.success(`Exported ${await exportCSV(db)} entries`)}
        />
        <SettingsRow
          icon={<FileJson className="size-[18px]" />}
          label="Full backup (JSON)"
          hint="Everything, including budgets and recurring bills"
          onClick={() => exportJSON(db)}
        />
      </SettingsGroup>

      <SettingsGroup title="Import">
        <SettingsRow
          icon={<FileUp className="size-[18px]" />}
          label="Import from CSV"
          hint="From a spreadsheet, another app or a bank statement"
          onClick={() => fileInput.current?.click()}
        />
      </SettingsGroup>
      <input
        ref={fileInput}
        type="file"
        accept=".csv,text/csv"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = "";
        }}
      />

      {csv && (
        <section className="mt-6 rounded-card border border-line bg-surface p-5" aria-label="Import preview">
          <h2 className="font-semibold">{csv.name}</h2>
          <p className="text-sm text-muted">{csv.rows.length - 1} rows. Match the columns:</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {select("date", "Date")}
            {select("amount", "Amount")}
            {select("note", "Description", true)}
            {select("category", "Category", true)}
          </div>
          <div className="mt-3">
            <Label htmlFor="date-format">Date format</Label>
            <select
              id="date-format"
              value={dateFormat}
              onChange={(e) => setDateFormat(e.target.value as DateFormat)}
              className="h-11 w-full rounded-xl border border-line bg-surface px-3 text-base"
            >
              <option value="DD/MM/YYYY">DD/MM/YYYY (28/09/2026)</option>
              <option value="MM/DD/YYYY">MM/DD/YYYY (09/28/2026)</option>
              <option value="YYYY-MM-DD">YYYY-MM-DD (2026-09-28)</option>
            </select>
          </div>

          {drafts.length > 0 && (
            <>
              <h3 className="mt-5 mb-2 text-sm font-semibold tracking-wide text-muted uppercase">Preview</h3>
              <ul className="divide-y divide-line text-sm">
                {drafts.slice(0, 5).map((d, i) => (
                  <li key={i} className="flex justify-between gap-3 py-2">
                    <span className="min-w-0 truncate">
                      {d.ok ? (
                        <>
                          {d.date} · {categories?.find((c) => c.id === d.categoryId)?.name} · {d.note || "—"}
                        </>
                      ) : (
                        <span className="text-danger">Can&apos;t read this row</span>
                      )}
                    </span>
                    <span className="shrink-0 tabular-nums">
                      {d.amount ? formatMoney(toMinor(d.amount, currency), currency) : ""}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-sm text-muted">
                {valid.length} ready to import
                {drafts.length - valid.length > 0 && `, ${drafts.length - valid.length} will be skipped`}.
              </p>
            </>
          )}

          <div className="mt-4 flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setCsv(null)}>
              Cancel
            </Button>
            <Button className="flex-1" disabled={!valid.length} loading={importing} onClick={runImport}>
              Import {valid.length || ""}
            </Button>
          </div>
        </section>
      )}
    </>
  );
}
