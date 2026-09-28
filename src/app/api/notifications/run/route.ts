import { NextResponse, type NextRequest } from "next/server";
import { addDays } from "@/lib/dates";
import {
  BILLS_HOUR,
  RECAP_HOUR,
  billsReminder,
  dailyReminder,
  groupActivity,
  localTime,
  validTimeZone,
  weeklyRecap,
} from "@/lib/push/schedule";
import { formatMoney } from "@/lib/money";
import { sendToSubscriptions, type PushMessage } from "@/lib/push/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The notification scheduler. Call it hourly (see README) with `Authorization: Bearer $CRON_SECRET`.
 * For each user with a subscribed device it checks their local hour and sends, at most once each:
 * the daily reminder (nothing logged yet), bills due today/tomorrow (9am), and the Sunday recap (7pm).
 * `?dryRun=1` reports what would be sent without sending or logging. `?now=<ISO>` overrides the clock (testing).
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const dryRun = request.nextUrl.searchParams.get("dryRun") === "1";
  const nowParam = request.nextUrl.searchParams.get("now");
  const now = nowParam ? new Date(nowParam) : new Date();
  const admin = createAdminClient();

  const { data: subscriptions, error } = await admin
    .from("push_subscriptions")
    .select("user_id, endpoint, p256dh, auth");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const byUser = Map.groupBy(subscriptions, (s) => s.user_id);
  if (!byUser.size) return NextResponse.json({ users: 0, sent: [] });

  const { data: profiles } = await admin
    .from("profiles")
    .select("id, timezone, currency, notify_daily, notify_daily_hour, notify_bills, notify_weekly, notify_groups")
    .in("id", [...byUser.keys()]);

  const report: { user: string; kind: string; message: PushMessage; delivered: number }[] = [];

  for (const profile of profiles ?? []) {
    const { date, hour, weekday } = localTime(now, validTimeZone(profile.timezone));
    const currency = profile.currency ?? "INR";
    const due: { kind: string; message: PushMessage }[] = [];

    if (profile.notify_daily && hour === profile.notify_daily_hour) {
      const { count } = await admin
        .from("expenses")
        .select("id", { count: "exact", head: true })
        .eq("user_id", profile.id)
        .eq("spent_on", date)
        .is("deleted_at", null);
      if (!count) due.push({ kind: "daily", message: dailyReminder() });
    }

    if (profile.notify_bills && hour === BILLS_HOUR) {
      const { data: rules } = await admin
        .from("recurring_rules")
        .select("note, amount_minor, currency, next_due_on, kind, categories(name)")
        .eq("user_id", profile.id)
        .eq("is_active", true)
        .eq("kind", "expense")
        .is("deleted_at", null)
        .lte("next_due_on", addDays(date, 1))
        .order("next_due_on");
      const message = billsReminder(
        (rules ?? []).map((r) => ({ ...r, category: (r.categories as { name: string } | null)?.name ?? "Bill" })),
        date,
      );
      if (message) due.push({ kind: "bills", message });
    }

    if (profile.notify_weekly && weekday === 0 && hour === RECAP_HOUR) {
      const { data: rows } = await admin
        .from("expenses")
        .select("amount_minor, spent_on")
        .eq("user_id", profile.id)
        .eq("kind", "expense")
        .eq("reimbursable", false)
        .is("deleted_at", null)
        .gte("spent_on", addDays(date, -13))
        .lte("spent_on", date);
      const weekStart = addDays(date, -6);
      const sum = (from: string, to: string) =>
        (rows ?? []).filter((r) => r.spent_on >= from && r.spent_on <= to).reduce((s, r) => s + r.amount_minor, 0);
      const message = weeklyRecap(sum(weekStart, date), sum(addDays(date, -13), addDays(date, -7)), currency);
      if (message) due.push({ kind: "weekly", message });
    }

    // Group activity: expenses others added recently in your groups (any hour), once per expense.
    if (profile.notify_groups) {
      const { data: mine } = await admin
        .from("group_members")
        .select("id, group_id")
        .eq("user_id", profile.id)
        .is("deleted_at", null);
      if (mine?.length) {
        const groupIds = mine.map((m) => m.group_id);
        const since = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();
        const [{ data: recent }, { data: members }, { data: groups }, { data: logged }] = await Promise.all([
          admin
            .from("group_expenses")
            .select("id, group_id, paid_by_member_id, description, amount_minor, currency, splits, created_by")
            .in("group_id", groupIds)
            .gte("created_at", since)
            .is("deleted_at", null)
            .neq("created_by", profile.id),
          admin.from("group_members").select("id, display_name").in("group_id", groupIds),
          admin.from("groups").select("id, name").in("id", groupIds),
          admin
            .from("notification_log")
            .select("key")
            .eq("user_id", profile.id)
            .eq("kind", "group")
            .gte("sent_at", since),
        ]);
        const seen = new Set((logged ?? []).map((l) => l.key));
        const names = new Map((members ?? []).map((m) => [m.id, m.display_name]));
        const fresh = (recent ?? []).filter((e) => !seen.has(e.id));
        for (const group of groups ?? []) {
          const items = fresh.filter((e) => e.group_id === group.id);
          if (!items.length) continue;
          const myMember = mine.find((m) => m.group_id === group.id)?.id;
          const message = groupActivity({
            groupName: group.name,
            items: items.map((e) => {
              const share = (e.splits as { member_id: string; share_minor: number }[]).find(
                (s) => s.member_id === myMember,
              )?.share_minor;
              return {
                who: names.get(e.paid_by_member_id) ?? "Someone",
                description: e.description,
                amount: formatMoney(e.amount_minor, e.currency),
                yourShare: share ? formatMoney(share, e.currency) : null,
              };
            }),
          });
          if (dryRun) {
            report.push({ user: profile.id, kind: "group", message, delivered: 0 });
            continue;
          }
          const { error: logError } = await admin
            .from("notification_log")
            .insert(items.map((e) => ({ user_id: profile.id, kind: "group", key: e.id })));
          if (logError) continue;
          const delivered = await sendToSubscriptions(admin, byUser.get(profile.id) ?? [], message);
          report.push({ user: profile.id, kind: "group", message, delivered });
        }
      }
    }

    for (const { kind, message } of due) {
      if (dryRun) {
        report.push({ user: profile.id, kind, message, delivered: 0 });
        continue;
      }
      // The log's primary key makes each reminder once-only, even if the scheduler runs twice.
      const { error: logError } = await admin.from("notification_log").insert({ user_id: profile.id, kind, key: date });
      if (logError) continue; // already sent
      const delivered = await sendToSubscriptions(admin, byUser.get(profile.id) ?? [], message);
      report.push({ user: profile.id, kind, message, delivered });
    }
  }

  return NextResponse.json({ users: byUser.size, dryRun, sent: report });
}
