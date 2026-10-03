"use client";

import {
  CalendarRange,
  Coins,
  FileDown,
  CreditCard,
  Info,
  Mail,
  PiggyBank,
  Repeat,
  Shapes,
  TrendingUp,
  User,
  Wallet,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useData } from "@/components/data/data-provider";
import { Button } from "@/components/ui/button";
import { CurrencyPicker } from "@/components/ui/currency-picker";
import { Input } from "@/components/ui/input";
import { MonthStartSelect, monthStartLabel } from "@/components/ui/month-start-select";
import { Sheet } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { currencyName } from "@/lib/currencies";
import { updateProfile } from "@/lib/db/mutations";
import { useProfile } from "@/lib/db/queries";
import { DeleteAccount } from "./delete-account";
import { InstallRow } from "./install-row";
import { SettingsGroup, SettingsRow } from "./settings-group";
import { SignOutButton } from "./sign-out-button";
import { NotificationsSection } from "./notifications-section";
import { ThemePicker } from "./theme-picker";

type Editing = "name" | "currency" | "monthStart" | null;

export function SettingsScreen() {
  const router = useRouter();
  const { db, email } = useData();
  const profile = useProfile();
  const [editing, setEditing] = useState<Editing>(null);

  const icon = (Icon: typeof User) => <Icon className="size-[18px]" />;

  return (
    <>
      <header className="flex h-16 items-center pt-2">
        <h1 className="text-[1.75rem] font-semibold tracking-tight">Settings</h1>
      </header>

      <SettingsGroup title="Account">
        <SettingsRow
          icon={icon(User)}
          label="Name"
          hint={profile?.display_name || "Not set"}
          onClick={() => setEditing("name")}
        />
        <SettingsRow icon={icon(Mail)} label="Email" hint={email ?? undefined} />
      </SettingsGroup>

      <SettingsGroup title="Money">
        <SettingsRow
          icon={icon(Coins)}
          label="Currency"
          hint={profile?.currency ? `${currencyName(profile.currency)} (${profile.currency})` : undefined}
          onClick={() => setEditing("currency")}
        />
        <SettingsRow
          icon={icon(CalendarRange)}
          label="Month starts on"
          hint={profile ? monthStartLabel(profile.month_start_day) : undefined}
          onClick={() => setEditing("monthStart")}
        />
        <SettingsRow
          icon={icon(PiggyBank)}
          label="Budgets"
          hint="Monthly limits and safe-to-spend"
          onClick={() => router.push("/settings/budgets")}
        />
        <SettingsRow
          icon={icon(Repeat)}
          label="Recurring"
          hint="Rent, subscriptions, EMIs"
          onClick={() => router.push("/settings/recurring")}
        />
        <SettingsRow
          icon={icon(TrendingUp)}
          label="Track income"
          hint="Add income and see what you save"
          trailing={
            <Switch
              label="Track income"
              checked={profile?.track_income ?? false}
              onChange={(checked) => updateProfile(db, { track_income: checked })}
            />
          }
        />
      </SettingsGroup>

      <SettingsGroup title="Add expense">
        <SettingsRow icon={icon(Shapes)} label="Categories" onClick={() => router.push("/settings/categories")} />
        <SettingsRow
          icon={icon(Wallet)}
          label="Payment methods"
          onClick={() => router.push("/settings/payment-methods")}
        />
        <SettingsRow
          icon={icon(CreditCard)}
          label="Ask for payment method"
          hint="Show the payment row when adding"
          trailing={
            <Switch
              label="Ask for payment method"
              checked={profile?.show_payment_method ?? true}
              onChange={(checked) => updateProfile(db, { show_payment_method: checked })}
            />
          }
        />
      </SettingsGroup>

      <NotificationsSection />

      <section className="mt-6">
        <h2 className="mb-2 px-1 text-sm font-semibold tracking-wide text-muted uppercase">Appearance</h2>
        <ThemePicker />
      </section>

      <SettingsGroup title="App">
        <SettingsRow
          icon={icon(FileDown)}
          label="Export & import"
          hint="CSV, full backup, import from other apps"
          onClick={() => router.push("/settings/data")}
        />
        <InstallRow />
        <SettingsRow icon={icon(Info)} label="Version" hint={process.env.NEXT_PUBLIC_APP_VERSION} />
      </SettingsGroup>

      <div className="mt-8 space-y-3">
        <SignOutButton />
        <DeleteAccount />
      </div>

      {profile && (
        <>
          <NameSheet
            open={editing === "name"}
            initial={profile.display_name ?? ""}
            onClose={() => setEditing(null)}
            onSave={(name) => updateProfile(db, { display_name: name.trim() || null })}
          />
          <Sheet
            open={editing === "currency"}
            onOpenChange={(open) => !open && setEditing(null)}
            title="Currency"
            description="Changes the symbol shown everywhere. Amounts you've already logged aren't converted."
          >
            <CurrencyPicker
              value={profile.currency ?? "USD"}
              onChange={(currency) => {
                updateProfile(db, { currency });
                setEditing(null);
              }}
            />
          </Sheet>
          <Sheet
            open={editing === "monthStart"}
            onOpenChange={(open) => !open && setEditing(null)}
            title="Month starts on"
            description="Home and Insights count your month from this day, e.g. your payday."
          >
            <MonthStartSelect
              value={profile.month_start_day}
              onChange={(day) => {
                updateProfile(db, { month_start_day: day });
                setEditing(null);
              }}
            />
          </Sheet>
        </>
      )}
    </>
  );
}

function NameSheet({
  open,
  initial,
  onClose,
  onSave,
}: {
  open: boolean;
  initial: string;
  onClose: () => void;
  onSave: (name: string) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()} title="Your name">
      <form
        key={String(open)}
        onSubmit={(e) => {
          e.preventDefault();
          onSave(String(new FormData(e.currentTarget).get("name") ?? ""));
          onClose();
        }}
        className="space-y-4"
      >
        <Input name="name" defaultValue={initial} maxLength={60} autoFocus aria-label="Name" />
        <Button type="submit" size="lg" className="w-full">
          Save
        </Button>
      </form>
    </Sheet>
  );
}
