"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Label } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { MemberAvatar } from "./member-avatar";

type Preview = {
  id: string;
  name: string;
  emoji: string;
  already_member: boolean;
  members: { id: string; name: string; claimed: boolean }[];
};

/** /join/<code>: pick your named spot (if a friend added you) or join as someone new. */
export function JoinScreen({ code, defaultName }: { code: string; defaultName: string }) {
  const router = useRouter();
  const [preview, setPreview] = useState<Preview | null | undefined>(undefined);
  const [choice, setChoice] = useState<string | "new" | null>(null);
  const [name, setName] = useState(defaultName);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    createClient()
      .rpc("group_preview", { p_code: code })
      .then(({ data }) => setPreview((data as Preview | null) ?? null));
  }, [code]);

  useEffect(() => {
    if (preview?.already_member) router.replace(`/groups/${preview.id}`);
  }, [preview, router]);

  if (preview === undefined || preview?.already_member) return <Skeleton className="h-64" />;
  if (preview === null) {
    return (
      <EmptyState
        emoji="🔗"
        title="This invite doesn't work"
        description="The link may be wrong, or the group was deleted. Ask for a new link."
        action={
          <Link href="/groups" className="font-semibold underline">
            Go to your groups
          </Link>
        }
      />
    );
  }

  const open = preview.members.filter((m) => !m.claimed);
  const selected = choice ?? (open.length ? null : "new");

  async function join() {
    if (!selected) return toast.error("Pick who you are.");
    setJoining(true);
    const { data, error } = await createClient().rpc("join_group", {
      p_code: code,
      p_member_id: selected === "new" ? undefined : selected,
      p_display_name: selected === "new" ? name.trim() || defaultName : undefined,
    });
    if (error || !data) {
      setJoining(false);
      return toast.error(error?.message ?? "Couldn't join. Try again.");
    }
    router.replace(`/groups/${data}`);
  }

  return (
    <>
      <div className="mb-6 grid size-20 place-items-center rounded-[1.75rem] border border-line bg-surface text-4xl">
        {preview.emoji}
      </div>
      <h1 className="text-[2rem] leading-tight font-semibold tracking-tight">Join {preview.name}</h1>
      <p className="mt-2 text-[15px] text-muted">
        With{" "}
        {preview.members
          .filter((m) => m.claimed)
          .map((m) => m.name)
          .join(", ") || "friends"}
        . Split expenses and see who owes whom.
      </p>

      {open.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-2 text-sm font-semibold tracking-wide text-muted uppercase">Which one is you?</h2>
          <ul className="space-y-2">
            {open.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  aria-pressed={selected === m.id}
                  onClick={() => setChoice(m.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left",
                    selected === m.id ? "border-ink bg-surface ring-2 ring-ink" : "border-line bg-surface",
                  )}
                >
                  <MemberAvatar id={m.id} name={m.name} />
                  <span className="text-[15px] font-medium">I&apos;m {m.name}</span>
                </button>
              </li>
            ))}
            <li>
              <button
                type="button"
                aria-pressed={selected === "new"}
                onClick={() => setChoice("new")}
                className={cn(
                  "w-full rounded-2xl border px-4 py-3 text-left text-[15px] font-medium",
                  selected === "new" ? "border-ink bg-surface ring-2 ring-ink" : "border-line bg-surface",
                )}
              >
                I&apos;m not on this list
              </button>
            </li>
          </ul>
        </section>
      )}

      {selected === "new" && (
        <div className="mt-6">
          <Label htmlFor="join-name">Your name in this group</Label>
          <Input id="join-name" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
        </div>
      )}

      <Button size="lg" className="mt-8 w-full" loading={joining} disabled={!selected} onClick={join}>
        Join group
      </Button>
    </>
  );
}
