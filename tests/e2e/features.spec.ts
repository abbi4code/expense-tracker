import { expect, test, type APIRequestContext } from "@playwright/test";
import { addDays, addMonths, todayISO } from "@/lib/dates";
import {
  admin,
  createUser,
  groupWithExpense,
  logIn,
  mirrors,
  sheet,
  signedInClient,
  skipWithoutSupabase,
} from "./helpers";

// Phase 5: paste a payment message, favourites, budget alerts, settle-up reminders, repeating
// group expenses (rent). Scheduler tests call the dry run with a fixed clock.

skipWithoutSupabase();

const CRON_SECRET = process.env.CRON_SECRET ?? "e2e-cron-secret";

async function categoryId(userId: string, name: string) {
  const { data } = await admin().from("categories").select("id").eq("user_id", userId).eq("name", name).single();
  return data!.id;
}

async function addExpenses(userId: string, rows: { amount: number; category: string; note: string; on: string }[]) {
  for (const row of rows) {
    const { error } = await admin()
      .from("expenses")
      .insert({
        user_id: userId,
        amount_minor: row.amount,
        currency: "INR",
        category_id: await categoryId(userId, row.category),
        note: row.note,
        spent_on: row.on,
      });
    if (error) throw error;
  }
}

/** What the scheduler would send to this user at `at` (dry run: nothing is sent or logged). */
async function scheduled(request: APIRequestContext, userId: string, at: string) {
  const response = await request.get(`/api/notifications/run?dryRun=1&now=${encodeURIComponent(at)}`, {
    headers: { authorization: `Bearer ${CRON_SECRET}` },
  });
  expect(response.ok()).toBe(true);
  const { sent } = (await response.json()) as {
    sent: { user: string; kind: string; message: { title: string; body: string; url: string } }[];
  };
  return sent.filter((s) => s.user === userId);
}

/** A user the scheduler will consider: a device subscribed, Indian time zone. */
async function subscribed(name: string) {
  const user = await createUser(name);
  await admin().from("profiles").update({ timezone: "Asia/Kolkata" }).eq("id", user.id);
  await admin()
    .from("push_subscriptions")
    .insert({ user_id: user.id, endpoint: `https://push.example/${user.id}`, p256dh: "key", auth: "auth" });
  return user;
}

const ist = (date: string, hour: number) => `${date}T${String(hour).padStart(2, "0")}:00:00+05:30`;
const smsDate = (iso: string) => `${iso.slice(8, 10)}-${iso.slice(5, 7)}-${iso.slice(2, 4)}`;

test.describe("paste a payment message", () => {
  const yesterday = addDays(todayISO(), -1);
  const sms = `Dear UPI user A/C X1234 debited by 250.0 on date ${smsDate(yesterday)} trf to UBER INDIA Refno 427612345678. If not u? call 1800111109. -SBI`;

  test("fills the Add sheet from the clipboard", async ({ browser }) => {
    const user = await createUser("Paste");
    const page = await logIn(browser, user.email, { permissions: ["clipboard-read", "clipboard-write"] });
    await page.evaluate((text) => navigator.clipboard.writeText(text), sms);
    await page.getByRole("button", { name: "Add expense" }).click();
    await sheet(page).getByRole("button", { name: "Paste a payment message" }).click();
    await expect(page.getByText("Filled from your message")).toBeVisible();
    await expect(sheet(page).getByRole("button", { name: "Yesterday" })).toBeVisible();
    await expect(sheet(page).getByRole("button", { name: "Uber India" })).toBeVisible();
    await sheet(page).getByRole("button", { name: "Add", exact: true }).click();

    await expect
      .poll(async () => {
        const { data } = await admin()
          .from("expenses")
          .select("amount_minor, note, spent_on, category_id, payment_methods(name)")
          .eq("user_id", user.id);
        return data;
      })
      .toEqual([
        {
          amount_minor: 250_00,
          note: "Uber India",
          spent_on: yesterday,
          category_id: await categoryId(user.id, "Transport"),
          payment_methods: { name: "UPI / Online" },
        },
      ]);
  });

  test("falls back to a box to paste into when the clipboard can't be read", async ({ browser }) => {
    const user = await createUser("Paste");
    const page = await logIn(browser, user.email);
    await page.getByRole("button", { name: "Add expense" }).click();
    await sheet(page).getByRole("button", { name: "Paste a payment message" }).click();
    const box = sheet(page).getByRole("textbox", { name: "Payment message" });
    await box.fill(sms);
    await box.press("Enter");
    await expect(page.getByText("Filled from your message")).toBeVisible();
    await expect(sheet(page).getByRole("button", { name: "Uber India" })).toBeVisible();
  });
});

test("favourites: pin, one-tap log, undo, pin from an expense, reorder, remove", async ({ browser }) => {
  const user = await createUser("Fav");
  const today = todayISO();
  await addExpenses(user.id, [
    ...[3, 5, 8].map((d) => ({ amount: 20_00, category: "Food & Drinks", note: "Chai", on: addDays(today, -d) })),
    { amount: 40_00, category: "Transport", note: "Metro", on: addDays(today, -1) },
  ]);
  const chaiCount = async () =>
    (await admin().from("expenses").select("id").eq("user_id", user.id).eq("note", "Chai").is("deleted_at", null)).data
      ?.length;
  const page = await logIn(browser, user.email);

  await test.step("pin a suggestion from history", async () => {
    await page.getByRole("button", { name: "Add or edit favourites" }).click();
    await expect(sheet(page).getByText("₹20 · 3 times")).toBeVisible();
    await sheet(page).getByRole("button", { name: "Pin Chai" }).click();
    await expect(sheet(page).getByText("Log the same thing 3 times")).toBeVisible(); // no more suggestions
    await page.keyboard.press("Escape");
    await expect(sheet(page)).toBeHidden();
  });

  await test.step("one tap logs it for today, with undo", async () => {
    await page.getByRole("button", { name: "Log Chai, ₹20" }).click();
    await expect(page.getByText("Added ₹20")).toBeVisible();
    await expect.poll(chaiCount).toBe(4);
    await page.getByRole("button", { name: "Undo" }).click();
    await expect.poll(chaiCount).toBe(3);
  });

  await test.step("pin an expense from its edit sheet", async () => {
    await page.getByText("Metro").first().click();
    await sheet(page).getByRole("button", { name: "Favourite" }).click();
    await expect(page.getByText("Pinned to Home")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Log Metro, ₹40" })).toBeVisible();
  });

  await test.step("long-press opens the editor instead of logging", async () => {
    // A handle, because once the editor opens the row behind it is hidden from the accessibility tree.
    const tile = (await page.getByRole("button", { name: "Log Chai, ₹20" }).elementHandle())!;
    await tile.dispatchEvent("pointerdown");
    await page.waitForTimeout(700);
    await tile.dispatchEvent("pointerup");
    await tile.dispatchEvent("click");
    await expect(sheet(page).getByRole("heading", { name: "Favourites" })).toBeVisible();
    expect(await chaiCount()).toBe(3);
  });

  await test.step("reorder and remove", async () => {
    await sheet(page).getByRole("button", { name: "Move Metro up" }).click();
    await expect
      .poll(async () => {
        const { data } = await admin()
          .from("favourites")
          .select("note")
          .eq("user_id", user.id)
          .is("deleted_at", null)
          .order("sort_order");
        return data?.map((f) => f.note);
      })
      .toEqual(["Metro", "Chai"]);
    await sheet(page).getByRole("button", { name: "Remove Chai" }).click();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Log Chai, ₹20" })).toBeHidden();
    await expect(page.getByRole("button", { name: "Log Metro, ₹40" })).toBeVisible();
  });
});

test("budget alerts at 80% and 100%, once each, only in the daytime", async ({ request }) => {
  const user = await subscribed("Budget");
  const today = todayISO();
  const food = await categoryId(user.id, "Food & Drinks");
  await admin().from("budgets").insert({ user_id: user.id, category_id: food, amount_minor: 6000_00 });
  await addExpenses(user.id, [{ amount: 4920_00, category: "Food & Drinks", note: "Dinners", on: today }]);
  const budgetAlerts = async (hour: number) =>
    (await scheduled(request, user.id, ist(today, hour))).filter((s) => s.kind === "budget");

  const [alert] = await budgetAlerts(12);
  expect(alert.message.title).toBe("🍔 Food & Drinks is at 82% of its budget");
  expect(await budgetAlerts(23)).toEqual([]); // not at night

  // Once the 80% one is logged as sent, only going over sends another.
  const { data: budget } = await admin().from("budgets").select("id").eq("user_id", user.id).single();
  const periodStart = `${today.slice(0, 8)}01`;
  await admin()
    .from("notification_log")
    .insert({ user_id: user.id, kind: "budget", key: `${budget!.id}:${periodStart}:80` });
  expect(await budgetAlerts(12)).toEqual([]);
  await addExpenses(user.id, [{ amount: 1380_00, category: "Food & Drinks", note: "Party", on: today }]);
  expect((await budgetAlerts(12)).map((a) => a.message.title)).toEqual(["Over your 🍔 Food & Drinks budget"]);

  await admin().from("profiles").update({ notify_budgets: false }).eq("id", user.id);
  expect(await budgetAlerts(12)).toEqual([]);
});

test("settle-up reminders go to whoever owes, after two weeks", async ({ request }) => {
  const { asha, bina, groupId, memberOf, asBina } = await groupWithExpense();
  for (const user of [asha, bina]) {
    await admin().from("profiles").update({ timezone: "Asia/Kolkata" }).eq("id", user.id);
    await admin()
      .from("push_subscriptions")
      .insert({ user_id: user.id, endpoint: `https://push.example/${user.id}`, p256dh: "key", auth: "auth" });
  }
  const reminders = async (userId: string, days: number) =>
    (await scheduled(request, userId, ist(addDays(todayISO(), days), 10))).filter((s) => s.kind === "settle");

  expect(await reminders(bina.id, 7)).toEqual([]);
  const [reminder] = await reminders(bina.id, 15);
  expect(reminder.message.body).toBe("Just a nudge: you've owed Asha ₹300 for 2 weeks. Tap to settle up.");
  expect(reminder.message.url).toBe(`/groups/${groupId}`);
  expect(await reminders(asha.id, 15)).toEqual([]); // being owed never nags

  await asBina.from("settlements").insert({
    group_id: groupId,
    from_member_id: memberOf(bina.id),
    to_member_id: memberOf(asha.id),
    amount_minor: 300_00,
    currency: "INR",
  });
  expect(await reminders(bina.id, 15)).toEqual([]);
});

test("rent that repeats every month", async ({ browser }) => {
  const { asha, bina, groupId, asAsha } = await groupWithExpense();
  const today = todayISO();
  const rentRows = async () =>
    (
      await admin()
        .from("group_expenses")
        .select("id, spent_on, amount_minor, deleted_at, recurring_rule_id")
        .eq("group_id", groupId)
        .not("recurring_rule_id", "is", null)
        .order("spent_on")
    ).data ?? [];
  const rule = async () =>
    (await admin().from("group_recurring_rules").select("*").eq("group_id", groupId).single()).data!;

  const a = await logIn(browser, asha.email);
  await test.step("add rent starting two months ago: the months so far are added", async () => {
    await a.goto(`/groups/${groupId}`);
    await a.getByRole("button", { name: "Add group expense" }).click();
    await sheet(a).locator("#ge-description").fill("Rent");
    await sheet(a).locator("#ge-amount").fill("30000");
    await sheet(a).getByLabel("Pick a date").fill(addMonths(today, -2));
    await sheet(a).getByRole("switch", { name: "Every month" }).click();
    await sheet(a).getByRole("button", { name: "Add expense" }).click();
    await expect(a.getByText("repeats every month")).toBeVisible();
    await expect
      .poll(async () => (await rentRows()).map((r) => r.spent_on))
      .toEqual([addMonths(today, -2), addMonths(today, -1), today]);
    await expect.poll(async () => (await rule()).next_due_on).toBe(addMonths(today, 1));
    await expect(a.getByRole("region", { name: "Repeating" }).getByText("You pay · every month")).toBeVisible();
  });

  await test.step("the other member's app doesn't add them again, and mirrors her shares", async () => {
    const b = await logIn(browser, bina.email);
    await b.goto(`/groups/${groupId}`);
    await expect(b.getByText("Rent").first()).toBeVisible();
    await expect
      .poll(async () => (await mirrors(bina.id)).map((m) => m.amount_minor).sort((x, y) => x - y))
      .toEqual([300_00, 15000_00, 15000_00, 15000_00]);
    expect(await rentRows()).toHaveLength(3);
  });

  await test.step("a deleted month stays deleted", async () => {
    const [first] = await rentRows();
    await admin().from("group_expenses").update({ deleted_at: new Date().toISOString() }).eq("id", first.id);
    // Another member's app trying to add that month again ("insert if missing") changes nothing.
    await asAsha.from("group_expenses").upsert(
      {
        ...first,
        deleted_at: null,
        group_id: groupId,
        paid_by_member_id: (await rule()).paid_by_member_id,
        currency: "INR",
        description: "Rent",
        split_mode: "equal",
        splits: (await rule()).splits,
      },
      { ignoreDuplicates: true },
    );
    // Even an app that thinks the rule is still at its first month leaves it deleted.
    await admin()
      .from("group_recurring_rules")
      .update({ next_due_on: first.spent_on })
      .eq("id", first.recurring_rule_id!);
    await a.reload();
    await expect.poll(async () => (await rule()).next_due_on).toBe(addMonths(today, 1));
    expect((await rentRows()).map((r) => Boolean(r.deleted_at))).toEqual([true, false, false]);
  });

  await test.step("editing the repeating expense changes future months only; pause", async () => {
    await a.getByRole("region", { name: "Repeating" }).getByRole("button").click();
    await expect(sheet(a).getByRole("heading", { name: "Edit repeating expense" })).toBeVisible();
    await sheet(a).locator("#ge-amount").fill("32000");
    await sheet(a).getByRole("button", { name: "Save" }).click();
    await expect.poll(async () => (await rule()).amount_minor).toBe(32000_00);
    expect((await rentRows()).every((r) => r.amount_minor === 30000_00)).toBe(true);

    await a.getByRole("region", { name: "Repeating" }).getByRole("button").click();
    await sheet(a).getByRole("button", { name: "Pause" }).click();
    await expect.poll(async () => (await rule()).is_active).toBe(false);
    await expect(a.getByRole("region", { name: "Repeating" }).getByText("paused")).toBeVisible();
  });
});

test("only group members can see or add repeating expenses", async () => {
  const { groupId, memberOf, asha } = await groupWithExpense();
  const outsider = await signedInClient((await createUser("Eve")).email);
  const { error } = await outsider.from("group_recurring_rules").insert({
    group_id: groupId,
    paid_by_member_id: memberOf(asha.id),
    amount_minor: 100,
    currency: "INR",
    description: "Sneaky",
    splits: [{ member_id: memberOf(asha.id), share_minor: 100 }],
    anchor_date: todayISO(),
    next_due_on: todayISO(),
  });
  expect(error).not.toBeNull();
});
