import { expect, test } from "@playwright/test";
import { favouriteSuggestions } from "@/lib/favourites";

let n = 0;
const spend = (amount: number, category: string, note: string | null, extra: object = {}) => ({
  amount_minor: amount,
  currency: "INR",
  category_id: category,
  payment_method_id: null,
  note,
  spent_on: `2026-09-${String(10 + (n % 18)).padStart(2, "0")}`,
  created_at: `2026-09-01T00:00:${String(n++ % 60).padStart(2, "0")}Z`,
  ...extra,
});

test("repeat spends (3+) are suggested, most repeated first", () => {
  const expenses = [
    ...Array.from({ length: 3 }, () => spend(2000, "food", "Chai")),
    ...Array.from({ length: 5 }, () => spend(4000, "transport", "Metro")),
    spend(2000, "food", "chai "), // same as "Chai", ignoring case and spaces
    spend(9900, "fun", "Movie"),
    spend(9900, "fun", "Movie"),
  ];
  const suggestions = favouriteSuggestions(expenses, []);
  expect(suggestions.map((s) => [s.note, s.amount_minor, s.count])).toEqual([
    ["Metro", 4000, 5],
    ["Chai", 2000, 4],
  ]);
});

test("pinned favourites, bills, group shares, income and work expenses aren't suggested", () => {
  const expenses = [
    ...Array.from({ length: 3 }, () => spend(2000, "food", "Chai")),
    ...Array.from({ length: 3 }, () => spend(64900, "fun", "Netflix", { recurring_rule_id: "r1" })),
    ...Array.from({ length: 3 }, () => spend(30000, "food", "Dinner", { group_expense_id: "g1" })),
    ...Array.from({ length: 3 }, () => spend(100000, "salary", "Salary", { kind: "income" })),
    ...Array.from({ length: 3 }, () => spend(50000, "travel", "Cab", { reimbursable: true })),
    ...Array.from({ length: 3 }, () => spend(5600, "groceries", "Milk", { deleted_at: "2026-09-20" })),
  ];
  expect(favouriteSuggestions(expenses, [{ amount_minor: 2000, category_id: "food", note: "chai" }])).toEqual([]);
  // An unpinned (deleted) favourite can be suggested again.
  expect(
    favouriteSuggestions(expenses, [{ amount_minor: 2000, category_id: "food", note: "Chai", deleted_at: "x" }]),
  ).toHaveLength(1);
});
