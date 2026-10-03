import type { GroupMember } from "@/lib/db/local";
import { formatMoney } from "@/lib/money";

export const memberName = (member: GroupMember | undefined, myId: string | undefined) =>
  !member ? "Someone" : member.id === myId ? "You" : member.display_name;

/** Like memberName, but marks people who've left (they still appear on old expenses and balances). */
export const memberLabel = (member: GroupMember | undefined, myId: string | undefined) =>
  member?.deleted_at && member.id !== myId ? `${member.display_name} (left)` : memberName(member, myId);

/** "You're owed ₹1,200" / "You owe ₹300" / "All settled up". */
export function balanceText(amount: number, currency: string) {
  if (amount > 0) return { text: `You're owed ${formatMoney(amount, currency)}`, tone: "text-success" };
  if (amount < 0) return { text: `You owe ${formatMoney(-amount, currency)}`, tone: "text-ink" };
  return { text: "All settled up", tone: "text-muted" };
}
