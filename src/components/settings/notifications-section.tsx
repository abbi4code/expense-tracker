"use client";

import { Bell, BellRing, CalendarClock, Clock, Gauge, HandCoins, Receipt, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useData } from "@/components/data/data-provider";
import { Switch } from "@/components/ui/switch";
import { updateProfile } from "@/lib/db/mutations";
import { useProfile } from "@/lib/db/queries";
import { currentSubscription, disablePush, enablePush, pushSupport, sendTestPush } from "@/lib/push/client";
import { useHydrated } from "@/lib/use-hydrated";
import { SettingsGroup, SettingsRow } from "./settings-group";

const HOURS = Array.from({ length: 24 }, (_, h) => h);
const hourLabel = (h: number) => new Date(2026, 0, 1, h).toLocaleTimeString(undefined, { hour: "numeric" });

export function NotificationsSection() {
  const { db } = useData();
  const profile = useProfile();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  // Browser-only capability: decided after hydration so server and client render the same HTML.
  const hydrated = useHydrated();
  const support = hydrated ? pushSupport() : null;

  useEffect(() => {
    currentSubscription().then((sub) => setEnabled(Boolean(sub)));
  }, []);

  async function toggle(on: boolean) {
    setBusy(true);
    try {
      if (on) {
        await enablePush();
        // Reminders are sent at the user's local hour.
        await updateProfile(db, { timezone: Intl.DateTimeFormat().resolvedOptions().timeZone });
        toast.success("Notifications on for this device");
      } else {
        await disablePush();
      }
      setEnabled(on);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const icon = (Icon: typeof Bell) => <Icon className="size-[18px]" />;

  if (!support) return null;
  if (support !== "supported") {
    return (
      <SettingsGroup title="Notifications">
        <SettingsRow
          icon={icon(Bell)}
          label="Reminders"
          hint={
            support === "needs-install"
              ? "On iPhone, add the app to your home screen first"
              : "Not supported in this browser"
          }
        />
      </SettingsGroup>
    );
  }

  return (
    <SettingsGroup title="Notifications">
      <SettingsRow
        icon={icon(BellRing)}
        label="Notifications on this device"
        hint={enabled ? "On" : "Reminders to log, bills, weekly recap"}
        trailing={
          <Switch
            label="Notifications on this device"
            checked={Boolean(enabled)}
            onChange={(on) => !busy && toggle(on)}
          />
        }
      />
      {enabled && profile && (
        <>
          <SettingsRow
            icon={icon(Clock)}
            label="Daily reminder"
            hint="Only if you haven't logged anything that day"
            trailing={
              <div className="flex items-center gap-2">
                <select
                  aria-label="Reminder time"
                  value={profile.notify_daily_hour}
                  disabled={!profile.notify_daily}
                  onChange={(e) => updateProfile(db, { notify_daily_hour: Number(e.target.value) })}
                  className="h-9 rounded-lg border border-line bg-surface px-2 text-sm disabled:opacity-40"
                >
                  {HOURS.map((h) => (
                    <option key={h} value={h}>
                      {hourLabel(h)}
                    </option>
                  ))}
                </select>
                <Switch
                  label="Daily reminder"
                  checked={profile.notify_daily}
                  onChange={(on) => updateProfile(db, { notify_daily: on })}
                />
              </div>
            }
          />
          <SettingsRow
            icon={icon(Receipt)}
            label="Bills due"
            hint="9am, the day before and on the day"
            trailing={
              <Switch
                label="Bills due"
                checked={profile.notify_bills}
                onChange={(on) => updateProfile(db, { notify_bills: on })}
              />
            }
          />
          <SettingsRow
            icon={icon(Gauge)}
            label="Budget alerts"
            hint="At 80% and 100% of a budget, 9am to 9pm"
            trailing={
              <Switch
                label="Budget alerts"
                checked={profile.notify_budgets}
                onChange={(on) => updateProfile(db, { notify_budgets: on })}
              />
            }
          />
          <SettingsRow
            icon={icon(Users)}
            label="Group activity"
            hint="When friends add expenses you're part of"
            trailing={
              <Switch
                label="Group activity"
                checked={profile.notify_groups}
                onChange={(on) => updateProfile(db, { notify_groups: on })}
              />
            }
          />
          <SettingsRow
            icon={icon(HandCoins)}
            label="Settle-up reminders"
            hint="When you've owed someone for 2 weeks, weekly"
            trailing={
              <Switch
                label="Settle-up reminders"
                checked={profile.notify_settle}
                onChange={(on) => updateProfile(db, { notify_settle: on })}
              />
            }
          />
          <SettingsRow
            icon={icon(CalendarClock)}
            label="Sunday recap"
            hint="7pm: your week vs last week"
            trailing={
              <Switch
                label="Sunday recap"
                checked={profile.notify_weekly}
                onChange={(on) => updateProfile(db, { notify_weekly: on })}
              />
            }
          />
          <SettingsRow
            icon={icon(Bell)}
            label="Send a test notification"
            onClick={async () => {
              try {
                const delivered = await sendTestPush();
                toast(
                  delivered
                    ? "Sent. Check your notifications."
                    : "No device received it. Try turning notifications off and on.",
                );
              } catch (error) {
                toast.error((error as Error).message);
              }
            }}
          />
        </>
      )}
    </SettingsGroup>
  );
}
