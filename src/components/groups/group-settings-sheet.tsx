"use client";

import { Copy, Share2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { useData } from "@/components/data/data-provider";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import type { Group, GroupMember } from "@/lib/db/local";
import { addNamedMember, updateGroup, updateMember } from "@/lib/db/mutations";
import { formatMoney } from "@/lib/money";
import { createClient } from "@/lib/supabase/client";
import { MemberAvatar } from "./member-avatar";

type GroupSettingsSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: Group;
  members: GroupMember[];
  me: GroupMember;
  myBalance: number;
};

export const inviteUrl = (group: Group) => `${window.location.origin}/join/${group.invite_code}`;

export async function shareInvite(group: Group) {
  const url = inviteUrl(group);
  const text = `Join "${group.name}" to split expenses`;
  if (navigator.share) {
    try {
      await navigator.share({ title: group.name, text, url });
      return;
    } catch (error) {
      if ((error as Error).name === "AbortError") return;
    }
  }
  await navigator.clipboard.writeText(url);
  toast.success("Invite link copied");
}

export function GroupSettingsSheet({ open, onOpenChange, group, members, me, myBalance }: GroupSettingsSheetProps) {
  const router = useRouter();
  const { db, sync } = useData();
  const [newMember, setNewMember] = useState("");
  const [confirming, setConfirming] = useState<"leave" | "delete" | null>(null);

  async function leave() {
    const { error } = await createClient().rpc("leave_group", { p_group: group.id });
    if (error) return toast.error("Couldn't leave. Leaving needs a connection.");
    await sync();
    router.replace("/groups");
    toast(`You left ${group.name}`);
  }

  async function remove() {
    await updateGroup(db, group, { deleted_at: new Date().toISOString() });
    router.replace("/groups");
    toast(`Deleted ${group.name}`);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={`${group.emoji} ${group.name}`}>
      <div className="space-y-7">
        <section>
          <h3 className="mb-2 text-sm font-semibold tracking-wide text-muted uppercase">Invite</h3>
          <p className="mb-3 text-sm text-muted">Anyone with the link can join this group.</p>
          <div className="flex gap-2">
            <Button className="flex-1" onClick={() => shareInvite(group)}>
              <Share2 className="size-4" /> Share invite link
            </Button>
            <Button
              variant="secondary"
              size="icon"
              aria-label="Copy invite link"
              onClick={async () => {
                await navigator.clipboard.writeText(inviteUrl(group));
                toast.success("Invite link copied");
              }}
            >
              <Copy className="size-4" />
            </Button>
          </div>
        </section>

        <section>
          <h3 className="mb-2 text-sm font-semibold tracking-wide text-muted uppercase">Members</h3>
          <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
            {members.map((m) => (
              <li key={m.id} className="flex items-center gap-3 px-3 py-2.5">
                <MemberAvatar id={m.id} name={m.display_name} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-medium">
                    {m.display_name}
                    {m.id === me.id && " (you)"}
                  </span>
                  <span className="block text-sm text-muted">
                    {m.role === "owner" ? "Created the group" : m.user_id ? "Joined" : "Not joined yet"}
                    {m.upi_id ? ` · UPI ${m.upi_id}` : ""}
                  </span>
                </span>
              </li>
            ))}
          </ul>
          <form
            className="mt-3 flex gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!newMember.trim()) return;
              await addNamedMember(db, group.id, newMember);
              setNewMember("");
            }}
          >
            <Input
              value={newMember}
              maxLength={60}
              placeholder="Add someone by name"
              aria-label="Add someone by name"
              onChange={(e) => setNewMember(e.target.value)}
            />
            <Button type="submit" variant="secondary" className="h-13" disabled={!newMember.trim()}>
              Add
            </Button>
          </form>
        </section>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            const upi = String(new FormData(e.currentTarget).get("upi") ?? "").trim();
            if (upi && !/^[\w.\-]{2,}@[a-zA-Z]{2,}$/.test(upi))
              return toast.error("That doesn't look like a UPI ID (name@bank).");
            updateMember(db, me, { upi_id: upi || null });
            toast.success(upi ? "UPI ID saved. Friends can pay you in one tap." : "UPI ID removed");
          }}
        >
          <Label htmlFor="upi">Your UPI ID (optional)</Label>
          <div className="flex gap-2">
            <Input
              id="upi"
              name="upi"
              defaultValue={me.upi_id ?? ""}
              placeholder="name@okbank"
              autoCapitalize="none"
              autoCorrect="off"
            />
            <Button type="submit" variant="secondary" className="h-13">
              Save
            </Button>
          </div>
          <p className="mt-1.5 text-sm text-subtle">Shown to group members so they can pay you back via UPI.</p>
        </form>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            const name = String(new FormData(e.currentTarget).get("name") ?? "").trim();
            if (name) updateGroup(db, group, { name });
            toast.success("Renamed");
          }}
        >
          <Label htmlFor="rename">Group name</Label>
          <div className="flex gap-2">
            <Input id="rename" name="name" defaultValue={group.name} maxLength={60} />
            <Button type="submit" variant="secondary" className="h-13">
              Save
            </Button>
          </div>
        </form>

        {confirming ? (
          <div className="space-y-3 rounded-2xl bg-danger/10 p-4">
            <p className="text-[15px]">
              {confirming === "leave"
                ? myBalance !== 0
                  ? `You're not settled up (${myBalance > 0 ? "owed" : "owe"} ${formatMoney(Math.abs(myBalance), group.currency)}). Your expenses stay in the group under your name.`
                  : "Your expenses stay in the group under your name."
                : "This deletes the group for everyone. Expenses already mirrored to people's own spending are kept."}
            </p>
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => setConfirming(null)}>
                Cancel
              </Button>
              <Button variant="danger" className="flex-1" onClick={confirming === "leave" ? leave : remove}>
                {confirming === "leave" ? "Leave group" : "Delete group"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <Button variant="secondary" size="lg" className="w-full" onClick={() => setConfirming("leave")}>
              Leave group
            </Button>
            {me.role === "owner" && (
              <Button variant="danger" size="lg" className="w-full" onClick={() => setConfirming("delete")}>
                Delete group
              </Button>
            )}
          </div>
        )}
      </div>
    </Sheet>
  );
}
