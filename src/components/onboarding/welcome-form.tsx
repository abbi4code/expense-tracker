"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CurrencyPicker } from "@/components/ui/currency-picker";
import { Label } from "@/components/ui/input";
import { MonthStartSelect } from "@/components/ui/month-start-select";
import { guessCurrency } from "@/lib/currencies";
import { createClient } from "@/lib/supabase/client";
import { useHydrated } from "@/lib/use-hydrated";

export function WelcomeForm({ userId, firstName }: { userId: string; firstName?: string }) {
  const router = useRouter();
  const hydrated = useHydrated();
  const [suggested] = useState(() => (typeof navigator === "undefined" ? "USD" : guessCurrency()));
  const [currency, setCurrency] = useState<string | null>(null);
  const [monthStartDay, setMonthStartDay] = useState(1);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  // The guess depends on the device locale, so only use it once hydrated.
  const selected = currency ?? (hydrated ? suggested : "");

  async function finish() {
    setLoading(true);
    setError("");
    const { error } = await createClient()
      .from("profiles")
      .update({
        currency: selected,
        month_start_day: monthStartDay,
        locale: navigator.language,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        onboarded_at: new Date().toISOString(),
      })
      .eq("id", userId);
    if (error) {
      setLoading(false);
      return setError("Couldn't save. Check your connection and try again.");
    }
    router.replace("/home?add=1");
    router.refresh();
  }

  return (
    <>
      <h1 className="text-[2rem] leading-tight font-semibold tracking-tight">
        {firstName ? `Welcome, ${firstName}!` : "Welcome!"}
      </h1>
      <p className="mt-2 text-[15px] leading-relaxed text-muted">Two quick things, then log your first expense.</p>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold tracking-wide text-muted uppercase">Your currency</h2>
        {selected && <CurrencyPicker value={selected} onChange={setCurrency} suggested={suggested} />}
      </section>

      <section className="mt-8">
        <Label htmlFor="month-start" className="text-sm font-semibold tracking-wide uppercase">
          Your month starts on
        </Label>
        <MonthStartSelect id="month-start" value={monthStartDay} onChange={setMonthStartDay} />
        <p className="mt-1.5 text-sm text-subtle">
          Paid on the 25th? Start your month then. You can change this later.
        </p>
      </section>

      {error && (
        <p role="alert" className="mt-6 text-sm text-danger">
          {error}
        </p>
      )}
      <Button size="lg" className="mt-8 w-full" loading={loading} disabled={!hydrated || !selected} onClick={finish}>
        Let&apos;s go
      </Button>
    </>
  );
}
