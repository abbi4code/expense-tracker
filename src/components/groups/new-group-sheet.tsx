"use client";

import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { useData } from "@/components/data/data-provider";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { useProfile } from "@/lib/db/queries";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const EMOJIS = ["🏖️", "🏠", "✈️", "🍕", "🎉", "🏔️", "🚗", "💼", "❤️", "⚽", "🎓", "👥"];

export function NewGroupSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="New group">
      <NewGroupForm key={String(open)} onDone={() => onOpenChange(false)} />
    </Sheet>
  );
}

function NewGroupForm({ onDone }: { onDone: () => void }) {
  const router = useRouter();
  const { sync } = useData();
  const profile = useProfile();
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("🏖️");
  const [friend, setFriend] = useState("");
  const [friends, setFriends] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  function addFriend() {
    const trimmed = friend.trim();
    if (trimmed && !friends.includes(trimmed)) setFriends((f) => [...f, trimmed]);
    setFriend("");
  }

  async function create() {
    if (!name.trim()) return toast.error("Give the group a name.");
    setCreating(true);
    const { data: groupId, error } = await createClient().rpc("create_group", {
      p_name: name.trim(),
      p_emoji: emoji,
      p_currency: profile?.currency ?? "INR",
      p_display_name: profile?.display_name || "Me",
      p_member_names: friend.trim() ? [...friends, friend.trim()] : friends,
    });
    if (error || !groupId) {
      setCreating(false);
      return toast.error("Couldn't create the group. Creating a group needs a connection.");
    }
    await sync();
    onDone();
    router.push(`/groups/${groupId}?invite=1`);
  }

  return (
    <div className="space-y-5">
      <div>
        <Label htmlFor="group-name">Name</Label>
        <div className="flex gap-2">
          <span className="grid size-13 shrink-0 place-items-center rounded-2xl bg-surface-2 text-2xl">{emoji}</span>
          <Input
            id="group-name"
            value={name}
            maxLength={60}
            placeholder="Goa trip, Flat 4B…"
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {EMOJIS.map((option) => (
            <button
              key={option}
              type="button"
              aria-label={`Emoji ${option}`}
              aria-pressed={option === emoji}
              onClick={() => setEmoji(option)}
              className={cn(
                "grid size-10 place-items-center rounded-xl text-lg",
                option === emoji ? "bg-ink/10 ring-2 ring-ink" : "bg-surface-2",
              )}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label htmlFor="friend-name">Who&apos;s in it?</Label>
        <p className="mb-2 text-sm text-muted">
          Add friends by name now. They can join with the invite link later (or never, that&apos;s fine).
        </p>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            addFriend();
          }}
        >
          <Input
            id="friend-name"
            value={friend}
            maxLength={60}
            placeholder="Friend's name"
            onChange={(e) => setFriend(e.target.value)}
          />
          <Button type="submit" variant="secondary" className="h-13" disabled={!friend.trim()}>
            Add
          </Button>
        </form>
        {friends.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2">
            {friends.map((f) => (
              <li
                key={f}
                className="inline-flex h-9 items-center gap-1 rounded-full bg-surface-2 pr-1 pl-3.5 text-sm font-medium"
              >
                {f}
                <button
                  type="button"
                  aria-label={`Remove ${f}`}
                  className="grid size-7 place-items-center"
                  onClick={() => setFriends((all) => all.filter((x) => x !== f))}
                >
                  <X className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Button size="lg" className="w-full" loading={creating} onClick={create}>
        Create group
      </Button>
    </div>
  );
}
