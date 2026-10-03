import { expect, test, type Browser, type BrowserContextOptions, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Shared by the e2e tests. They need the local Supabase (API_URL, PUBLISHABLE_KEY, SECRET_KEY from
// `supabase status -o env`) and the app running against it at E2E_BASE_URL. See tests/README.md.

const API_URL = process.env.API_URL ?? "http://127.0.0.1:54321";
const PUBLISHABLE_KEY = process.env.PUBLISHABLE_KEY!;
const SECRET_KEY = process.env.SECRET_KEY!;
const PASSWORD = "test-pass-123";

export const skipWithoutSupabase = () =>
  test.skip(!SECRET_KEY || !PUBLISHABLE_KEY, "Set API_URL, PUBLISHABLE_KEY and SECRET_KEY for the local Supabase");

export const admin = () => createClient(API_URL, SECRET_KEY, { auth: { persistSession: false } });

/** A ready-to-use account (onboarded, INR) so tests skip the welcome flow. */
export async function createUser(name: string) {
  const email = `${name.toLowerCase()}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@e2e.test`;
  const { data, error } = await admin().auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { display_name: name },
  });
  if (error) throw error;
  await admin()
    .from("profiles")
    .update({ currency: "INR", onboarded_at: new Date().toISOString() })
    .eq("id", data.user.id);
  return { id: data.user.id, email, name };
}

export async function signedInClient(email: string): Promise<SupabaseClient> {
  const client = createClient(API_URL, PUBLISHABLE_KEY, { auth: { persistSession: false } });
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw error;
  return client;
}

export async function logIn(browser: Browser, email: string, options: BrowserContextOptions = {}) {
  const context = await browser.newContext(options);
  const page = await context.newPage();
  await page.goto("/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL(/\/home/);
  return page;
}

export const sheet = (page: Page) => page.getByRole("dialog");

/** The user's personal expenses mirrored from group expenses, as stored on the server. */
export async function mirrors(userId: string) {
  const { data } = await admin()
    .from("expenses")
    .select("amount_minor, note, deleted_at, spent_on")
    .eq("user_id", userId)
    .not("group_expense_id", "is", null)
    .order("spent_on")
    .order("created_at");
  return data ?? [];
}

/** A group made through the API: Asha (owner) and Bina, with one ₹600 expense Asha paid, split equally. */
export async function groupWithExpense() {
  const asha = await createUser("Asha");
  const bina = await createUser("Bina");
  const asAsha = await signedInClient(asha.email);
  const asBina = await signedInClient(bina.email);
  const { data: groupId } = await asAsha.rpc("create_group", {
    p_name: "Flat",
    p_emoji: "🏠",
    p_currency: "INR",
    p_display_name: "Asha",
    p_member_names: [],
  });
  const { data: group } = await asAsha.from("groups").select("invite_code").eq("id", groupId!).single();
  await asBina.rpc("join_group", { p_code: group!.invite_code, p_display_name: "Bina" });
  const { data: members } = await admin().from("group_members").select("id, user_id").eq("group_id", groupId!);
  const memberOf = (userId: string) => members!.find((m) => m.user_id === userId)!.id;
  const { data: expense } = await asAsha
    .from("group_expenses")
    .insert({
      group_id: groupId!,
      paid_by_member_id: memberOf(asha.id),
      amount_minor: 600_00,
      currency: "INR",
      description: "Groceries",
      split_mode: "equal",
      splits: [
        { member_id: memberOf(asha.id), share_minor: 300_00 },
        { member_id: memberOf(bina.id), share_minor: 300_00 },
      ],
    })
    .select()
    .single();
  return { asha, bina, asAsha, asBina, groupId: groupId!, inviteCode: group!.invite_code, memberOf, expense: expense! };
}

export { expect };
