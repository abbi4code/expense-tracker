// Reads bank SMS and UPI app messages ("Rs.450.00 debited … to VPA zomato@icici"), pasted or shared
// into the app. Rule-based and offline, tuned on the shapes Indian banks and UPI apps send.

import { addDays } from "./dates";

export type PaymentMessage = {
  amount: number | null;
  /** Who was paid, title-cased ("Uber India"); "" when the message doesn't say in a readable way. */
  merchant: string;
  /** The message's own date (DD-MM-YY etc.) when it's within the last 60 days; null otherwise. */
  spentOn: string | null;
  /** Money received rather than spent. */
  credit: boolean;
  upi: boolean;
  card: boolean;
};

const MONEY = /(?:₹|\brs\.?|\binr)\s*([\d,]+(?:\.\d{1,2})?)/gi;
// "Avl Bal Rs 12,345", "Updated Balance: Rs.1,234.50", "Avl Limit: INR …" aren't what was spent.
const NOT_SPENT_BEFORE = /(?:bal|balance|limit)\s*[:.-]?\s*$/i;
const SPENT_VERB = /\b(?:debited|spent|paid|sent)\s+(?:by|for|of|with)?\s*(\d[\d,]*(?:\.\d{1,2})?)\b/i;

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

export function parsePaymentMessage(text: string, today: string): PaymentMessage {
  return {
    amount: findAmount(text),
    merchant: findMerchant(text),
    spentOn: findDate(text, today),
    credit: /\b(?:credited|received)\b/i.test(text) && !/\b(?:debited|spent|paid|sent)\b/i.test(text),
    upi: /\bupi\b|\bvpa\b/i.test(text),
    card: /\bcard\b/i.test(text),
  };
}

function findAmount(text: string): number | null {
  for (const match of text.matchAll(MONEY)) {
    if (NOT_SPENT_BEFORE.test(text.slice(Math.max(0, match.index - 20), match.index))) continue;
    const value = toNumber(match[1]);
    if (value) return value;
  }
  const verb = text.match(SPENT_VERB);
  return verb ? toNumber(verb[1]) : null;
}

const toNumber = (digits: string) => {
  const value = Number(digits.replace(/,/g, ""));
  return value > 0 ? value : null;
};

function findMerchant(text: string): string {
  // Axis-style statement line: "UPI/P2M/627612345678/BLINKIT".
  const statement = text.match(/UPI\/P2[AM]\/\d+\/([^/\n]+)/i);
  if (statement) return titleCase(statement[1]);

  // A UPI ID: its name part, unless it's a QR code or phone number ("paytmqr2810…@paytm").
  const vpa = text.match(/\b(?:to|vpa)\s+(?:vpa\s+)?([a-z0-9._-]+)@[a-z]+/i);
  if (vpa) {
    if ((vpa[1].match(/\d/g)?.length ?? 0) >= 4) return "";
    return titleCase(vpa[1].replace(/[._-]+/g, " ").replace(/\d+/g, ""));
  }

  // Card spends: "… on 03-Oct-26 on AMAZON PAY IN." / "… at DMART."
  if (/\bspent\b/i.test(text)) {
    const card = text.match(/\b(?:on|at)\s+([A-Z][A-Z0-9&.' -]{1,40}?)(?=\.\s|\.$|\s+(?:avl|on|ref)\b|[\n,]|$)/);
    if (card) return titleCase(card[1]);
  }

  const payee = text.match(
    /\b(?:to|at|towards)\s+([A-Za-z][A-Za-z0-9&.' -]{1,40}?)(?=\s+(?:on|via|using|ref|refno|upi|for|from|successfully)\b|\s*[.,\n(]|$)/i,
  );
  if (payee && !/^(?:a\/?c|ac|account|your?)\b/i.test(payee[1])) return titleCase(payee[1]);
  return "";
}

function findDate(text: string, today: string): string | null {
  const numeric = text.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{4}|\d{2})\b/);
  const named = text.match(/\b(\d{1,2})[-\s]?([A-Za-z]{3})[-\s]?(\d{4}|\d{2})\b/);
  const parts = numeric
    ? [numeric[1], numeric[2], numeric[3]]
    : named && MONTHS.includes(named[2].toLowerCase())
      ? [named[1], String(MONTHS.indexOf(named[2].toLowerCase()) + 1), named[3]]
      : null;
  if (!parts) return null;
  const [day, month, year] = parts.map(Number);
  const iso = `${year < 100 ? 2000 + year : year}-${pad(month)}-${pad(day)}`;
  // Reject impossible dates (31-02) and anything outside the last 60 days.
  if (month < 1 || month > 12 || new Date(`${iso}T12:00:00`).getDate() !== day) return null;
  return iso <= today && iso >= addDays(today, -60) ? iso : null;
}

const pad = (n: number) => String(n).padStart(2, "0");
const titleCase = (s: string) =>
  s
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
