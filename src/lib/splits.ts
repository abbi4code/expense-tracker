// Splitting a group expense and working out who owes whom. All amounts are integer minor units,
// and every split adds up exactly to the total (leftover paise go to the first people).

export type SplitMode = "equal" | "exact" | "percent" | "shares";
export type Split = { member_id: string; share_minor: number; weight?: number };

export function splitEqually(amount: number, memberIds: string[]): Split[] {
  if (!memberIds.length) return [];
  const base = Math.floor(amount / memberIds.length);
  const extra = amount - base * memberIds.length;
  return memberIds.map((member_id, i) => ({ member_id, share_minor: base + (i < extra ? 1 : 0) }));
}

/** Proportional split (largest remainder), e.g. shares 2:1:1 or percentages. */
export function splitByWeights(amount: number, entries: { member_id: string; weight: number }[]): Split[] {
  const active = entries.filter((e) => e.weight > 0);
  const total = active.reduce((sum, e) => sum + e.weight, 0);
  if (!total) return [];
  const raw = active.map((e) => ({ ...e, exact: (amount * e.weight) / total }));
  const splits = raw.map((e) => ({ member_id: e.member_id, share_minor: Math.floor(e.exact), weight: e.weight }));
  let left = amount - splits.reduce((sum, s) => sum + s.share_minor, 0);
  const order = raw
    .map((e, i) => ({ i, frac: e.exact - Math.floor(e.exact) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const { i } of order) {
    if (left <= 0) break;
    splits[i].share_minor += 1;
    left -= 1;
  }
  return splits;
}

export type SplitInput = { member_id: string; value: number };

/**
 * `values` per mode: equal → 1 = included; exact → amount in minor units; percent → 0–100;
 * shares → share count. Returns the splits, or a message saying what doesn't add up.
 */
export function computeSplits(
  amount: number,
  mode: SplitMode,
  values: SplitInput[],
): { splits: Split[]; problem: null } | { splits: null; problem: string; difference?: number } {
  if (mode === "equal") {
    const ids = values.filter((v) => v.value > 0).map((v) => v.member_id);
    return ids.length
      ? { splits: splitEqually(amount, ids), problem: null }
      : { splits: null, problem: "Pick at least one person" };
  }
  if (mode === "exact") {
    const splits = values
      .filter((v) => v.value > 0)
      .map((v) => ({ member_id: v.member_id, share_minor: Math.round(v.value) }));
    const difference = amount - splits.reduce((sum, s) => sum + s.share_minor, 0);
    if (difference !== 0)
      return { splits: null, problem: difference > 0 ? "left to assign" : "over the total", difference };
    return splits.length ? { splits, problem: null } : { splits: null, problem: "Enter who paid what" };
  }
  if (mode === "percent") {
    const total = values.reduce((sum, v) => sum + v.value, 0);
    if (Math.abs(total - 100) > 0.001)
      return { splits: null, problem: `Percentages add up to ${round(total)}%, not 100%` };
  }
  const splits = splitByWeights(
    amount,
    values.map((v) => ({ member_id: v.member_id, weight: v.value })),
  );
  return splits.length ? { splits, problem: null } : { splits: null, problem: "Give at least one person a share" };
}

type GroupExpenseLike = {
  paid_by_member_id: string;
  amount_minor: number;
  splits: unknown;
  deleted_at?: string | null;
};
type SettlementLike = {
  from_member_id: string;
  to_member_id: string;
  amount_minor: number;
  deleted_at?: string | null;
};

/** Net position per member: positive = others owe them, negative = they owe. Sums to zero. */
export function memberBalances(expenses: GroupExpenseLike[], settlements: SettlementLike[]): Map<string, number> {
  const net = new Map<string, number>();
  const add = (id: string, value: number) => net.set(id, (net.get(id) ?? 0) + value);
  for (const e of expenses) {
    if (e.deleted_at) continue;
    add(e.paid_by_member_id, e.amount_minor);
    for (const s of e.splits as Split[]) add(s.member_id, -s.share_minor);
  }
  for (const s of settlements) {
    if (s.deleted_at) continue;
    add(s.from_member_id, s.amount_minor);
    add(s.to_member_id, -s.amount_minor);
  }
  return net;
}

export type Transfer = { from: string; to: string; amount: number };

/** Fewest practical payments to settle everyone: largest debtor pays largest creditor, repeat. */
export function simplifyDebts(balances: Map<string, number>): Transfer[] {
  const debtors = [...balances].filter(([, v]) => v < 0).map(([id, v]) => ({ id, left: -v }));
  const creditors = [...balances].filter(([, v]) => v > 0).map(([id, v]) => ({ id, left: v }));
  const transfers: Transfer[] = [];
  for (;;) {
    debtors.sort((a, b) => b.left - a.left);
    creditors.sort((a, b) => b.left - a.left);
    const debtor = debtors[0];
    const creditor = creditors[0];
    if (!debtor || !creditor || debtor.left === 0 || creditor.left === 0) break;
    const amount = Math.min(debtor.left, creditor.left);
    transfers.push({ from: debtor.id, to: creditor.id, amount });
    debtor.left -= amount;
    creditor.left -= amount;
    if (debtor.left === 0) debtors.shift();
    if (creditor.left === 0) creditors.shift();
  }
  return transfers;
}

const round = (n: number) => Math.round(n * 100) / 100;
