// Turns "uber 340 yesterday upi" into an expense draft. Rule-based: fast, offline, predictable.

import { addDays } from "./dates";
import { parsePaymentMessage } from "./payment-message";

export type QuickEntryContext = {
  today: string;
  categories: { id: string; name: string }[];
  paymentMethods: { id: string; name: string }[];
  /** Past notes (lowercased) → category id, most recent first wins. */
  noteHistory: Map<string, string>;
};

export type QuickEntry = {
  amount: number | null;
  note: string;
  categoryId: string | null;
  paymentMethodId: string | null;
  spentOn: string;
};

// Built-in hints for the default categories (matched by category name, so renamed ones just miss).
export const KEYWORDS: Record<string, string[]> = {
  "Food & Drinks": [
    "coffee",
    "chai",
    "tea",
    "lunch",
    "dinner",
    "breakfast",
    "snacks",
    "pizza",
    "burger",
    "biryani",
    "zomato",
    "swiggy",
    "restaurant",
    "cafe",
    "food",
    "drinks",
    "beer",
    "juice",
  ],
  Groceries: [
    "grocery",
    "groceries",
    "milk",
    "vegetables",
    "veggies",
    "fruits",
    "bigbasket",
    "blinkit",
    "zepto",
    "instamart",
    "dmart",
    "kirana",
  ],
  Transport: [
    "uber",
    "ola",
    "rapido",
    "auto",
    "cab",
    "taxi",
    "metro",
    "bus",
    "petrol",
    "diesel",
    "fuel",
    "parking",
    "toll",
  ],
  Shopping: ["amazon", "flipkart", "myntra", "ajio", "clothes", "shoes", "shopping"],
  "Bills & Utilities": [
    "electricity",
    "wifi",
    "internet",
    "broadband",
    "recharge",
    "mobile",
    "phone",
    "gas",
    "water",
    "bill",
    "dth",
  ],
  Rent: ["rent"],
  Health: ["medicine", "medicines", "pharmacy", "doctor", "hospital", "gym", "pharmeasy", "tests"],
  Entertainment: [
    "movie",
    "movies",
    "netflix",
    "spotify",
    "prime",
    "hotstar",
    "concert",
    "game",
    "games",
    "bookmyshow",
  ],
  Travel: ["flight", "hotel", "train", "irctc", "trip", "airbnb", "makemytrip"],
  Education: ["course", "books", "book", "udemy", "tuition", "fees"],
  "Personal Care": ["salon", "haircut", "spa", "grooming"],
  Gifts: ["gift", "gifts"],
};

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const FILLER = new Set([
  "for",
  "on",
  "at",
  "via",
  "by",
  "with",
  "using",
  "paid",
  "spent",
  "rs",
  "rs.",
  "inr",
  "₹",
  "to",
]);

/** "1.5k" → 1500, "2l" → 200000, "1,200" → 1200, "₹450" → 450. */
function parseAmountToken(token: string): number | null {
  const match = token
    .toLowerCase()
    .replace(/^(₹|rs\.?|inr|\$|€|£)/, "")
    .replace(/(\/-|rs\.?|inr)$/, "")
    .replace(/,/g, "")
    .match(/^(\d+(?:\.\d+)?)(k|l|lakh|lakhs)?$/);
  if (!match) return null;
  const value = Number(match[1]) * (match[2] === "k" ? 1_000 : match[2] ? 100_000 : 1);
  return value > 0 ? value : null;
}

export function parseQuickEntry(text: string, context: QuickEntryContext): QuickEntry {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const used = new Set<number>();
  const lower = words.map((w) => w.toLowerCase());
  let spentOn = context.today;

  // Dates: "today", "yesterday", "day before yesterday", "3 days ago", "monday".
  for (let i = 0; i < lower.length; i++) {
    if (lower[i] === "day" && lower[i + 1] === "before" && lower[i + 2] === "yesterday") {
      spentOn = addDays(context.today, -2);
      [i, i + 1, i + 2].forEach((j) => used.add(j));
    } else if (lower[i] === "yesterday" && !used.has(i)) {
      spentOn = addDays(context.today, -1);
      used.add(i);
    } else if (lower[i] === "today") {
      used.add(i);
    } else if (/^\d+$/.test(lower[i]) && /^days?$/.test(lower[i + 1] ?? "") && lower[i + 2] === "ago") {
      spentOn = addDays(context.today, -Number(lower[i]));
      [i, i + 1, i + 2].forEach((j) => used.add(j));
    } else {
      const day = WEEKDAYS.findIndex((d) => lower[i] === d || lower[i] === d.slice(0, 3));
      if (day >= 0) {
        const todayDay = new Date(`${context.today}T12:00:00`).getDay();
        spentOn = addDays(context.today, -((todayDay - day + 7) % 7)); // most recent such day (today counts)
        used.add(i);
      }
    }
  }

  // Amount: prefer a token with a currency marker ("₹450", "rs 450"), else the first number.
  let amount: number | null = null;
  const marked = lower.findIndex((w, i) => !used.has(i) && /^(₹|rs\.?|inr)\d/.test(w));
  const afterMarker = lower.findIndex(
    (w, i) => !used.has(i) && i > 0 && /^(₹|rs\.?|inr)$/.test(lower[i - 1]) && parseAmountToken(w),
  );
  const firstNumber = lower.findIndex((w, i) => !used.has(i) && parseAmountToken(w) !== null);
  const amountIndex = marked >= 0 ? marked : afterMarker >= 0 ? afterMarker : firstNumber;
  if (amountIndex >= 0) {
    amount = parseAmountToken(lower[amountIndex]);
    used.add(amountIndex);
  }

  // Payment method: a word matching the start of a method's name ("upi" → "UPI / Online").
  let paymentMethodId: string | null = null;
  for (let i = 0; i < lower.length && !paymentMethodId; i++) {
    if (used.has(i) || lower[i].startsWith("#")) continue;
    const method = context.paymentMethods.find((m) =>
      m.name
        .toLowerCase()
        .split(/[\s/]+/)
        .filter(Boolean)
        .includes(lower[i]),
    );
    if (method) {
      paymentMethodId = method.id;
      used.add(i);
    }
  }

  // Category named outright ("groceries", "health").
  let categoryId: string | null = null;
  for (let i = 0; i < lower.length && !categoryId; i++) {
    if (used.has(i)) continue;
    const category = context.categories.find((c) => {
      const name = c.name.toLowerCase();
      return name === lower[i] || name.split(/\s*&\s*|\s+/)[0] === lower[i];
    });
    if (category) {
      categoryId = category.id;
      // Keep the word in the note unless the note would be empty without it.
      used.add(i);
    }
  }

  const noteWords = words.filter((_, i) => !used.has(i) && !FILLER.has(lower[i]));
  let note = noteWords.join(" ");
  if (!note && categoryId) note = ""; // "groceries 500" → no note needed
  const noteKey = note.toLowerCase();

  if (!categoryId && noteKey) {
    // Learned: exact past note, then a past note starting with the same first word.
    const firstWord = noteKey.split(" ")[0];
    categoryId =
      context.noteHistory.get(noteKey) ??
      [...context.noteHistory].find(([past]) => past.split(" ")[0] === firstWord)?.[1] ??
      null;
  }
  if (!categoryId) {
    // Built-in keywords.
    for (const [categoryName, keywords] of Object.entries(KEYWORDS)) {
      if (noteKey.split(/\s+/).some((w) => keywords.includes(w.replace(/^#/, "")))) {
        categoryId = context.categories.find((c) => c.name === categoryName)?.id ?? null;
        if (categoryId) break;
      }
    }
  }

  return { amount, note: capitalize(note), categoryId, paymentMethodId, spentOn };
}

/**
 * A bank SMS or UPI confirmation (shared to the app or pasted) as an expense draft: amount, the
 * payee as the note, a category guessed from the payee, the message's date, UPI or card.
 */
export function parseSharedText(text: string, context: QuickEntryContext): QuickEntry & { credit: boolean } {
  const message = parsePaymentMessage(text, context.today);
  const parsed = parseQuickEntry(message.merchant, context);
  const method = (pattern: RegExp) => context.paymentMethods.find((m) => pattern.test(m.name))?.id;
  return {
    ...parsed,
    amount: message.amount,
    note: message.merchant,
    spentOn: message.spentOn ?? context.today,
    paymentMethodId: (message.upi && method(/upi/i)) || (message.card && method(/card/i)) || parsed.paymentMethodId,
    credit: message.credit,
  };
}

const capitalize = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
