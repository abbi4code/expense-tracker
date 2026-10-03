import { expect, test } from "@playwright/test";
import { periodContaining } from "@/lib/dates";
import { budgetAlerts, owingSince, settleReminder } from "@/lib/push/alerts";

const period = periodContaining("2026-10-18", 1); // Oct 1 – Oct 31 (end Nov 1)
const categories = [{ id: "food", name: "Food & Drinks", emoji: "🍔" }];
const food = { id: "b-food", category_id: "food", amount_minor: 6000_00 };
const overall = { id: "b-all", category_id: null, amount_minor: 30000_00 };

const alertsFor = (
  spent: Record<string, number>,
  sent: string[] = [],
  budgets: { id: string; category_id: string | null; amount_minor: number }[] = [food],
) =>
  budgetAlerts({
    budgets,
    spentByCategory: new Map(Object.entries(spent)),
    categories,
    period,
    today: "2026-10-18",
    currency: "INR",
    sent: new Set(sent),
  });

test.describe("budget alerts", () => {
  test("nothing under 80%", () => {
    expect(alertsFor({ food: 4799_00 })).toEqual([]);
  });

  test("80%: how much is left and for how long", () => {
    const [alert] = alertsFor({ food: 4920_00 });
    expect(alert.key).toBe("b-food:2026-10-01:80");
    expect(alert.message.title).toBe("🍔 Food & Drinks is at 82% of its budget");
    expect(alert.message.body).toBe("₹1,080 left of ₹6,000 for the next 14 days.");
  });

  test("each level once per period", () => {
    expect(alertsFor({ food: 4920_00 }, ["b-food:2026-10-01:80"])).toEqual([]);
    const [over] = alertsFor({ food: 6300_00 }, ["b-food:2026-10-01:80"]);
    expect(over.key).toBe("b-food:2026-10-01:100");
    expect(over.message.body).toBe("₹300 over ₹6,000, with 14 days to go.");
    expect(alertsFor({ food: 7000_00 }, ["b-food:2026-10-01:100"])).toEqual([]);
  });

  test("jumping past 100% sends only the over alert, and 80% isn't sent afterwards", () => {
    expect(alertsFor({ food: 6500_00 }).map((a) => a.key)).toEqual(["b-food:2026-10-01:100"]);
    expect(alertsFor({ food: 5000_00 }, ["b-food:2026-10-01:100"])).toEqual([]);
  });

  test("exactly at the budget says used up", () => {
    expect(alertsFor({ food: 6000_00 })[0].message.title).toBe("🍔 Food & Drinks budget used up");
  });

  test("the overall budget counts all categories", () => {
    const alerts = alertsFor({ food: 1000_00, travel: 23500_00 }, [], [overall, food]);
    expect(alerts.map((a) => a.message.title)).toEqual(["You've used 81% of your budget"]);
  });
});

const day = (n: number) => new Date(Date.UTC(2026, 9, n, 12)).toISOString();
const expense = (n: number, payer: string, splits: [string, number][], deleted_at: string | null = null) => ({
  created_at: day(n),
  deleted_at,
  paid_by_member_id: payer,
  amount_minor: splits.reduce((sum, [, share]) => sum + share, 0),
  splits: splits.map(([member_id, share_minor]) => ({ member_id, share_minor })),
});
const payment = (n: number, from: string, to: string, amount: number) => ({
  created_at: day(n),
  from_member_id: from,
  to_member_id: to,
  amount_minor: amount,
});

test.describe("settle-up reminders", () => {
  const me = new Set(["me"]);

  test("owing starts when the balance first goes below zero", () => {
    const expenses = [
      expense(1, "rahul", [
        ["rahul", 300],
        ["me", 300],
      ]),
      expense(5, "rahul", [["me", 100]]),
    ];
    expect(owingSince(expenses, [], me)).toBe(day(1));
  });

  test("paying back resets it; owing again starts a new clock", () => {
    const expenses = [expense(1, "rahul", [["me", 300]]), expense(8, "rahul", [["me", 200]])];
    expect(owingSince(expenses, [payment(3, "me", "rahul", 300)], me)).toBe(day(8));
    expect(owingSince(expenses.slice(0, 1), [payment(3, "me", "rahul", 300)], me)).toBeNull();
  });

  test("being owed money is never a reminder", () => {
    expect(owingSince([expense(1, "me", [["rahul", 300]])], [], me)).toBeNull();
  });

  test("your old spot counts after leaving and rejoining", () => {
    const expenses = [expense(1, "rahul", [["me-old", 300]])];
    expect(owingSince(expenses, [], new Set(["me-old", "me"]))).toBe(day(1));
  });

  const reminder = (now: Date, sent: string[] = []) =>
    settleReminder({
      group: { id: "g1", name: "Flat 4B", emoji: "🏠" },
      members: [
        { id: "me", display_name: "Asha" },
        { id: "rahul", display_name: "Rahul" },
      ],
      memberIds: me,
      expenses: [
        expense(1, "rahul", [
          ["rahul", 600_00],
          ["me", 600_00],
        ]),
      ],
      settlements: [],
      currency: "INR",
      now,
      sent: new Set(sent),
    });

  test("only after 14 days, then once a week", () => {
    expect(reminder(new Date(day(14)))).toBeNull();
    const first = reminder(new Date(day(15)))!;
    expect(first.message.body).toBe("Just a nudge: you've owed Rahul ₹600 for 2 weeks. Tap to settle up.");
    expect(first.message.url).toBe("/groups/g1");
    expect(reminder(new Date(day(20)), [first.key])).toBeNull();
    const next = reminder(new Date(day(22)), [first.key])!;
    expect(next.key).not.toBe(first.key);
    expect(next.message.body).toContain("3 weeks");
  });
});
