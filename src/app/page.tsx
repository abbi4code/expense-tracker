import Link from "next/link";
import { Logo } from "@/components/app/logo";
import { APP_NAME } from "@/lib/config";

const preview = [
  { emoji: "🍔", name: "Food & Drinks", amount: "4,820", width: "78%", color: "bg-accent" },
  { emoji: "🚕", name: "Transport", amount: "2,160", width: "46%", color: "bg-ink/80" },
  { emoji: "🛒", name: "Groceries", amount: "1,940", width: "38%", color: "bg-ink/40" },
];

export default function LandingPage() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-6 pt-safe pb-safe">
      <header className="flex items-center gap-2.5 pt-8">
        <Logo className="size-9" />
        <span className="text-lg font-semibold tracking-tight">{APP_NAME}</span>
      </header>

      <main className="flex flex-1 flex-col justify-center py-10">
        <h1 className="text-[2.75rem] leading-[1.05] font-semibold tracking-tighter">Know where your money goes.</h1>
        <p className="mt-4 text-lg leading-relaxed text-muted">
          Log a spend in three taps. See your month at a glance. No spreadsheets, no guilt.
        </p>

        <div className="mt-10 rounded-card border border-line bg-surface p-6 shadow-xl shadow-black/[0.04]" aria-hidden>
          <p className="text-sm font-medium text-muted">Spent this month</p>
          <p className="mt-1 text-5xl font-semibold tracking-tighter tabular-nums">12,480</p>
          <ul className="mt-6 space-y-3">
            {preview.map((row) => (
              <li key={row.name}>
                <div className="mb-1.5 flex justify-between text-sm">
                  <span>
                    {row.emoji} {row.name}
                  </span>
                  <span className="tabular-nums text-muted">{row.amount}</span>
                </div>
                <div className="h-2 rounded-full bg-surface-2">
                  <div className={`h-full rounded-full ${row.color}`} style={{ width: row.width }} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </main>

      <footer className="space-y-3 pb-8">
        <Link
          href="/signup"
          className="flex h-14 items-center justify-center rounded-full bg-ink text-base font-semibold text-bg transition active:scale-[0.97]"
        >
          Get started, it&apos;s free
        </Link>
        <Link
          href="/login"
          className="flex h-14 items-center justify-center rounded-full text-base font-semibold text-ink transition active:scale-[0.97]"
        >
          I already have an account
        </Link>
      </footer>
    </div>
  );
}
