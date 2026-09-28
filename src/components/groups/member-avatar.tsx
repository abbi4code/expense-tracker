import { cn } from "@/lib/utils";

const TONES = [
  "bg-orange-200 text-orange-900",
  "bg-sky-200 text-sky-900",
  "bg-lime-200 text-lime-900",
  "bg-violet-200 text-violet-900",
  "bg-pink-200 text-pink-900",
  "bg-amber-200 text-amber-900",
  "bg-emerald-200 text-emerald-900",
  "bg-rose-200 text-rose-900",
];

/** Initials in a colour picked from the member id, so each person keeps their colour. */
export function MemberAvatar({ id, name, className }: { id: string; name: string; className?: string }) {
  const tone = TONES[[...id].reduce((sum, c) => sum + c.charCodeAt(0), 0) % TONES.length];
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  return (
    <span
      className={cn("grid size-9 shrink-0 place-items-center rounded-full text-sm font-semibold", tone, className)}
      aria-hidden
    >
      {initials || "?"}
    </span>
  );
}
