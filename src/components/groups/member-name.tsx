import type { GroupMember } from "@/lib/db/local";
import { cn } from "@/lib/utils";
import { memberName } from "./format";

/** A member's name for tight rows: long names truncate, but "You" and "(left)" always stay visible. */
export function MemberName({
  member,
  myId,
  className,
}: {
  member: GroupMember | undefined;
  myId: string;
  className?: string;
}) {
  const left = member?.deleted_at && member.id !== myId;
  return (
    <span className={cn("flex min-w-0 items-baseline gap-1", member?.id === myId && "shrink-0", className)}>
      <span className="truncate">{memberName(member, myId)}</span>
      {left && <span className="shrink-0 text-sm font-normal text-muted">(left)</span>}
    </span>
  );
}
