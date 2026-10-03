import { expect, test } from "@playwright/test";
import {
  computeSplits,
  evenPercentages,
  memberBalances,
  simplifyDebts,
  splitByWeights,
  splitEqually,
} from "@/lib/splits";

const sum = (splits: { share_minor: number }[]) => splits.reduce((total, s) => total + s.share_minor, 0);
const ids = ["a", "b", "c"];

test.describe("splitting", () => {
  test("equal split adds up exactly; leftover paise go to the first people", () => {
    const splits = splitEqually(100_00 + 1, ids);
    expect(splits.map((s) => s.share_minor)).toEqual([3334, 3334, 3333]);
    expect(sum(splits)).toBe(10001);
  });

  test("weights use largest remainder and always add up", () => {
    for (const amount of [1, 7, 999, 100_00, 123_457]) {
      const splits = splitByWeights(amount, [
        { member_id: "a", weight: 2 },
        { member_id: "b", weight: 1 },
        { member_id: "c", weight: 1 },
      ]);
      expect(sum(splits)).toBe(amount);
    }
  });

  test("exact amounts must add up to the total", () => {
    const short = computeSplits(1000, "exact", [
      { member_id: "a", value: 400 },
      { member_id: "b", value: 500 },
    ]);
    expect(short.splits).toBeNull();
    expect(short.problem).toBe("left to assign");
    expect(short.splits === null && short.difference).toBe(100);
  });

  // The form pre-fills percent mode with these, so they must be accepted as they are.
  for (const people of [1, 2, 3, 6, 7, 9]) {
    test(`even percentages for ${people} people add up to 100`, () => {
      const percents = evenPercentages(people);
      // Shown in the form as typed text: at most 2 decimals.
      expect(percents.every((p) => /^\d+(\.\d{1,2})?$/.test(String(p)))).toBe(true);
      const values = percents.map((value, i) => ({ member_id: `m${i}`, value }));
      const result = computeSplits(300_00, "percent", values);
      expect(result.problem).toBeNull();
      expect(sum(result.splits ?? [])).toBe(300_00);
    });
  }
});

test.describe("balances", () => {
  test("net balances sum to zero and settle-up clears them", () => {
    const expenses = [
      { paid_by_member_id: "a", amount_minor: 3000, splits: splitEqually(3000, ids) },
      { paid_by_member_id: "b", amount_minor: 900, splits: splitEqually(900, ["b", "c"]) },
      { paid_by_member_id: "c", amount_minor: 500, splits: splitEqually(500, ids), deleted_at: "2026-01-01" },
    ];
    const balances = memberBalances(expenses, []);
    expect([...balances.values()].reduce((a, b) => a + b, 0)).toBe(0);
    expect(Object.fromEntries(balances)).toEqual({ a: 2000, b: -550, c: -1450 });

    const transfers = simplifyDebts(balances);
    expect(transfers).toEqual([
      { from: "c", to: "a", amount: 1450 },
      { from: "b", to: "a", amount: 550 },
    ]);
    const settlements = transfers.map((t) => ({ from_member_id: t.from, to_member_id: t.to, amount_minor: t.amount }));
    const after = memberBalances(expenses, settlements);
    expect([...after.values()].every((v) => v === 0)).toBe(true);
    expect(simplifyDebts(after)).toEqual([]);
  });
});
