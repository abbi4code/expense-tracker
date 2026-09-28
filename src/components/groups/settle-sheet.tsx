"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useData } from "@/components/data/data-provider";
import { AmountInput, parseAmount } from "@/components/ui/amount-input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import type { Group, GroupMember } from "@/lib/db/local";
import { deleteSettlement, recordSettlement } from "@/lib/db/mutations";
import { formatMoney, fromMinor, toMinor } from "@/lib/money";
import type { Transfer } from "@/lib/splits";
import { memberName } from "./format";
import { MemberAvatar } from "./member-avatar";

type SettleSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: Group;
  members: GroupMember[];
  me: GroupMember;
  transfer: Transfer | null;
};

/** Record a payment between two members (cash, UPI, anything); optionally open a UPI app. */
export function SettleSheet({ open, onOpenChange, group, members, me, transfer }: SettleSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Settle up">
      {transfer && (
        <SettleForm
          key={`${transfer.from}-${transfer.to}-${transfer.amount}`}
          {...{ group, members, me, transfer }}
          onDone={() => onOpenChange(false)}
        />
      )}
    </Sheet>
  );
}

function SettleForm({
  group,
  members,
  me,
  transfer,
  onDone,
}: Omit<SettleSheetProps, "open" | "onOpenChange"> & { transfer: Transfer; onDone: () => void }) {
  const { db } = useData();
  const [amountText, setAmountText] = useState(String(fromMinor(transfer.amount, group.currency)));
  const from = members.find((m) => m.id === transfer.from);
  const to = members.find((m) => m.id === transfer.to);
  const amountMinor = toMinor(parseAmount(amountText) ?? 0, group.currency);

  // UPI deep link: opens GPay/PhonePe/Paytm with the payee and amount filled in (India, INR only).
  const upiLink =
    to?.upi_id && group.currency === "INR" && from?.id === me.id && amountMinor > 0
      ? `upi://pay?${new URLSearchParams({ pa: to.upi_id, pn: to.display_name, am: fromMinor(amountMinor, "INR").toFixed(2), cu: "INR", tn: `${group.name} settle up` })}`
      : null;

  async function record() {
    if (!amountMinor) return toast.error("Enter an amount above zero.");
    const saved = await recordSettlement(db, {
      group_id: group.id,
      from_member_id: transfer.from,
      to_member_id: transfer.to,
      amount_minor: amountMinor,
      currency: group.currency,
    });
    onDone();
    toast(`Recorded ${formatMoney(amountMinor, group.currency)} payment`, {
      action: { label: "Undo", onClick: () => deleteSettlement(db, saved) },
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-center gap-3 py-2 text-[15px]">
        {from && <MemberAvatar id={from.id} name={from.display_name} />}
        <span className="font-medium">{memberName(from, me.id)}</span>
        <span className="text-muted">pays</span>
        <span className="font-medium">{memberName(to, me.id)}</span>
        {to && <MemberAvatar id={to.id} name={to.display_name} />}
      </div>
      <div>
        <Label htmlFor="settle-amount">Amount</Label>
        <AmountInput
          id="settle-amount"
          currency={group.currency}
          value={amountText}
          onChange={(e) => setAmountText(e.target.value)}
        />
      </div>
      {upiLink && (
        <a
          href={upiLink}
          className="flex h-14 w-full items-center justify-center rounded-full bg-accent text-base font-semibold text-accent-ink"
        >
          Pay {to?.display_name} via UPI
        </a>
      )}
      <Button size="lg" variant={upiLink ? "secondary" : "primary"} className="w-full" onClick={record}>
        {upiLink ? "I've paid, record it" : "Record payment"}
      </Button>
      {!to?.upi_id && group.currency === "INR" && from?.id === me.id && (
        <p className="text-center text-sm text-muted">
          Tip: when {to?.display_name} adds a UPI ID in the group, you can pay in one tap.
        </p>
      )}
    </div>
  );
}
