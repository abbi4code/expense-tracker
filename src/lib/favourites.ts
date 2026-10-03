// Favourites are pinned repeat spends ("Chai ₹20"). Suggestions come from the user's own history:
// the same amount, category and note logged again and again.

type Spend = {
  amount_minor: number;
  currency: string;
  category_id: string;
  payment_method_id: string | null;
  note: string | null;
  spent_on: string;
  created_at: string;
  kind?: string | null;
  reimbursable?: boolean | null;
  deleted_at?: string | null;
  recurring_rule_id?: string | null;
  group_expense_id?: string | null;
};

type Pinned = { amount_minor: number; category_id: string; note: string | null; deleted_at?: string | null };

export type FavouriteSuggestion = {
  amount_minor: number;
  currency: string;
  category_id: string;
  payment_method_id: string | null;
  note: string | null;
  count: number;
};

const MIN_REPEATS = 3;

/** Same amount + category + note (ignoring case) = the same favourite. */
export const favouriteKey = (row: { amount_minor: number; category_id: string; note: string | null }) =>
  `${row.amount_minor}|${row.category_id}|${(row.note ?? "").trim().toLowerCase()}`;

/**
 * Spends logged at least 3 times that aren't pinned yet, most repeated first. Bills (recurring)
 * and group shares are left out: they're added automatically already.
 */
export function favouriteSuggestions(expenses: Spend[], pinned: Pinned[], limit = 6): FavouriteSuggestion[] {
  const taken = new Set(pinned.filter((f) => !f.deleted_at).map(favouriteKey));
  const groups = new Map<string, { latest: Spend; count: number; spellings: Map<string, number> }>();
  for (const e of expenses) {
    if (e.deleted_at || e.kind === "income" || e.reimbursable || e.recurring_rule_id || e.group_expense_id) continue;
    const key = favouriteKey(e);
    if (taken.has(key)) continue;
    const group = groups.get(key) ?? { latest: e, count: 0, spellings: new Map<string, number>() };
    if (`${e.spent_on}${e.created_at}` > `${group.latest.spent_on}${group.latest.created_at}`) group.latest = e;
    group.count += 1;
    const spelling = e.note?.trim() ?? "";
    group.spellings.set(spelling, (group.spellings.get(spelling) ?? 0) + 1);
    groups.set(key, group);
  }
  return [...groups.values()]
    .filter((g) => g.count >= MIN_REPEATS)
    .sort((a, b) => b.count - a.count || b.latest.spent_on.localeCompare(a.latest.spent_on))
    .slice(0, limit)
    .map(({ latest, count, spellings }) => ({
      amount_minor: latest.amount_minor,
      currency: latest.currency,
      category_id: latest.category_id,
      payment_method_id: latest.payment_method_id,
      // The spelling used most ("Chai", not a one-off "chai").
      note: [...spellings].sort((a, b) => b[1] - a[1])[0][0] || null,
      count,
    }));
}
