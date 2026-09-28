import { ChevronLeft } from "lucide-react";
import Link from "next/link";

export function BackHeader({
  href,
  backLabel,
  title,
  action,
}: {
  href: string;
  backLabel: string;
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="pt-4 pb-4">
      <Link href={href} className="-ml-1 inline-flex h-9 items-center text-[15px] font-medium text-muted">
        <ChevronLeft className="size-5" />
        {backLabel}
      </Link>
      <div className="mt-1 flex items-center justify-between gap-3">
        <h1 className="line-clamp-2 min-w-0 text-[1.75rem] leading-tight font-semibold tracking-tight break-words">
          {title}
        </h1>
        {action}
      </div>
    </header>
  );
}
