import { expect, test, type Page } from "@playwright/test";
import { admin, createUser, groupWithExpense, logIn, mirrors, sheet, skipWithoutSupabase } from "./helpers";

// Two people share a group end to end: create, join by invite, split, settle, leave, delete.

skipWithoutSupabase();

async function addGroupExpense(page: Page, description: string, amount: string) {
  await page.getByRole("button", { name: "Add group expense" }).click();
  await sheet(page).locator("#ge-description").fill(description);
  await sheet(page).locator("#ge-amount").fill(amount);
  await expect(sheet(page).getByText("✓ Adds up")).toBeVisible();
  await sheet(page).getByRole("button", { name: "Add expense" }).click();
  await expect(sheet(page)).toBeHidden();
}

/** Waits until a change made on one phone has reached the server, before another phone reloads. */
async function onServer(table: "group_expenses" | "settlements", groupId: string, count: number) {
  await expect
    .poll(
      async () => (await admin().from(table).select("id").eq("group_id", groupId).is("deleted_at", null)).data?.length,
    )
    .toBe(count);
}

async function groupExpense(groupId: string, description: string) {
  const { data } = await admin()
    .from("group_expenses")
    .select("*")
    .eq("group_id", groupId)
    .like("description", `${description}%`)
    .single();
  return data!;
}

test("a shared group from invite to delete", async ({ browser }) => {
  const asha = await createUser("Asha");
  const bina = await createUser("Bina");
  const a = await logIn(browser, asha.email);
  const b = await logIn(browser, bina.email);
  let groupId = "";

  await test.step("Asha creates a group with two friends by name", async () => {
    await a.goto("/groups");
    await a.getByRole("button", { name: "Create a group" }).click();
    await sheet(a).locator("#group-name").fill("Goa");
    for (const friend of ["Bina", "Chen"]) {
      await sheet(a).getByPlaceholder("Friend's name").fill(friend);
      await sheet(a).getByPlaceholder("Friend's name").press("Enter");
    }
    await sheet(a).getByRole("button", { name: "Create group" }).click();
    await a.waitForURL(/\/groups\/[0-9a-f-]+\?invite=1/);
    groupId = a.url().match(/groups\/([0-9a-f-]+)/)![1];
    await sheet(a).getByRole("button", { name: "Later" }).click();
    await expect(a.getByText("3 people")).toBeVisible();
  });

  await test.step("Bina opens the invite link and claims her spot", async () => {
    const { data } = await admin().from("groups").select("invite_code").eq("id", groupId).single();
    await b.goto(`/join/${data!.invite_code}`);
    await b.getByRole("button", { name: "I'm Bina" }).click();
    await b.getByRole("button", { name: "Join group" }).click();
    await b.waitForURL(new RegExp(`/groups/${groupId}`));
    await expect(b.getByText("3 people")).toBeVisible();
  });

  await test.step("an equal split shows the right balance to both people", async () => {
    await addGroupExpense(a, "Cab", "600");
    await expect(a.getByText("You're owed ₹400")).toBeVisible();
    await onServer("group_expenses", groupId, 1);
    await b.reload();
    await expect(b.getByText("You owe ₹200").first()).toBeVisible();
  });

  await test.step("each person's share becomes a personal expense", async () => {
    await expect.poll(async () => (await mirrors(asha.id)).map((m) => m.amount_minor)).toEqual([200_00]);
    await expect.poll(async () => (await mirrors(bina.id)).map((m) => m.amount_minor)).toEqual([200_00]);
  });

  await test.step("Bina settles up and Asha sees it", async () => {
    await b.getByRole("button", { name: "Settle" }).click();
    await sheet(b).getByRole("button", { name: "Record payment" }).click();
    await expect(b.getByText("All settled up")).toBeVisible();
    await onServer("settlements", groupId, 1);
    await a.reload();
    await expect(a.getByText("You're owed ₹200")).toBeVisible();
  });

  await test.step("percent mode's starting values add up for 3 people", async () => {
    await a.getByRole("button", { name: "Add group expense" }).click();
    await sheet(a).locator("#ge-amount").fill("300");
    await sheet(a).getByRole("radio", { name: "%" }).click();
    await expect.soft(sheet(a).getByText("✓ Adds up"), "default 33.33% x 3 should be accepted").toBeVisible();
    await a.keyboard.press("Escape");
    await expect(sheet(a)).toBeHidden();
  });

  await test.step("Bina leaves without settling a new dinner", async () => {
    await addGroupExpense(a, "Dinner", "900");
    await onServer("group_expenses", groupId, 2);
    await b.reload();
    await expect(b.getByText("You owe ₹300").first()).toBeVisible();
    await b.getByRole("button", { name: "Members and settings" }).click();
    await sheet(b).getByRole("button", { name: "Leave group" }).click();
    await sheet(b).getByRole("button", { name: "Leave group" }).click();
    await b.waitForURL(/\/groups$/);
    // Her past shares stay in her own spending.
    await expect.poll(async () => (await mirrors(bina.id)).filter((m) => !m.deleted_at).length).toBe(2);
  });

  await test.step("Asha still sees what Bina owes", async () => {
    await a.reload();
    await a.getByRole("tab", { name: "balances" }).click();
    await expect(
      a
        .getByRole("listitem")
        .filter({ hasText: "Bina" })
        .filter({ hasText: "(left)" })
        .filter({ hasText: "owes ₹300" }),
    ).toBeVisible();
  });

  await test.step("editing an old expense keeps a departed member's share", async () => {
    await a.getByRole("tab", { name: "expenses" }).click();
    await a.getByRole("button", { name: /^Dinner/ }).click();
    await expect(sheet(a).getByRole("checkbox", { name: "Include Bina" })).toHaveAttribute("aria-checked", "true");
    await sheet(a).locator("#ge-description").fill("Dinner at the shack");
    await sheet(a).getByRole("button", { name: "Save" }).click();
    await expect(sheet(a)).toBeHidden();
    await expect
      .poll(async () =>
        (await groupExpense(groupId, "Dinner at")).splits.map((s: { share_minor: number }) => s.share_minor),
      )
      .toEqual([300_00, 300_00, 300_00]);
  });

  await test.step("deleting the group keeps shares already in personal spending", async () => {
    await a.getByRole("button", { name: "Members and settings" }).click();
    await sheet(a).getByRole("button", { name: "Delete group" }).click();
    await sheet(a).getByRole("button", { name: "Delete group" }).click();
    await a.waitForURL(/\/groups$/);
    await expect
      .poll(async () => (await admin().from("groups").select("deleted_at").eq("id", groupId).single()).data?.deleted_at)
      .not.toBeNull();
    // Let a full sync (and the share mirroring after it) run on the deleted group.
    await a.reload();
    await a.waitForTimeout(3000);
    const kept = (await mirrors(asha.id)).filter((m) => !m.deleted_at).map((m) => m.amount_minor);
    expect(kept).toEqual([200_00, 300_00]);
  });
});

test("your own edit to a group share sticks until the group expense changes", async ({ browser }) => {
  const { asha, asAsha, expense } = await groupWithExpense();
  const a = await logIn(browser, asha.email);
  await expect.poll(async () => (await mirrors(asha.id)).map((m) => m.amount_minor)).toEqual([300_00]);

  // Asha changes her copy (as if from her other phone); her app must not reset it.
  await asAsha.from("expenses").update({ amount_minor: 250_00 }).eq("group_expense_id", expense.id);
  await a.reload();
  await a.waitForTimeout(3000);
  expect((await mirrors(asha.id)).map((m) => m.amount_minor)).toEqual([250_00]);

  // A later change to the group expense does come through.
  await asAsha
    .from("group_expenses")
    .update({
      amount_minor: 800_00,
      splits: [
        { member_id: expense.paid_by_member_id, share_minor: 400_00 },
        ...(expense.splits as { member_id: string }[])
          .filter((s) => s.member_id !== expense.paid_by_member_id)
          .map((s) => ({ member_id: s.member_id, share_minor: 400_00 })),
      ],
    })
    .eq("id", expense.id);
  await a.reload();
  await expect.poll(async () => (await mirrors(asha.id)).map((m) => m.amount_minor)).toEqual([400_00]);
});

test("leaving and rejoining a group keeps your earlier shares", async ({ browser }) => {
  const { bina, asBina, groupId, inviteCode } = await groupWithExpense();
  const b = await logIn(browser, bina.email);
  await expect.poll(async () => (await mirrors(bina.id)).map((m) => m.amount_minor)).toEqual([300_00]);

  await asBina.rpc("leave_group", { p_group: groupId });
  await asBina.rpc("join_group", { p_code: inviteCode, p_display_name: "Bina" });
  await b.goto(`/groups/${groupId}`);
  await expect(b.getByText("2 people")).toBeVisible();
  await b.waitForTimeout(3000);
  expect((await mirrors(bina.id)).filter((m) => !m.deleted_at).map((m) => m.amount_minor)).toEqual([300_00]);
});

test("group permissions", async () => {
  const { asha, bina, asAsha, asBina, groupId, memberOf, expense } = await groupWithExpense();
  const member = async (userId: string) =>
    (await admin().from("group_members").select("*").eq("id", memberOf(userId)).single()).data!;

  await test.step("Bina can't change Asha's UPI ID (payments would go to her)", async () => {
    const { error } = await asBina.from("group_members").update({ upi_id: "bina@okbank" }).eq("id", memberOf(asha.id));
    expect(error?.message).toContain("only you can change your UPI ID");
    expect((await member(asha.id)).upi_id).toBeNull();
  });

  await test.step("Bina can't make herself owner, rename or remove Asha", async () => {
    const promote = await asBina.from("group_members").update({ role: "owner" }).eq("id", memberOf(bina.id));
    const rename = await asBina.from("group_members").update({ display_name: "Ash" }).eq("id", memberOf(asha.id));
    const remove = await asBina
      .from("group_members")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", memberOf(asha.id));
    expect([promote.error, rename.error, remove.error].every(Boolean)).toBe(true);
    expect((await member(bina.id)).role).toBe("member");
    expect((await member(asha.id)).display_name).toBe("Asha");
    expect((await member(asha.id)).deleted_at).toBeNull();
  });

  await test.step("Bina can't delete the group, change its invite link or hard-delete its data", async () => {
    const del = await asBina.from("groups").update({ deleted_at: new Date().toISOString() }).eq("id", groupId);
    const code = await asBina.from("groups").update({ invite_code: "mine" }).eq("id", groupId);
    expect(del.error && code.error).toBeTruthy();
    await asBina.from("group_expenses").delete().eq("id", expense.id);
    expect((await admin().from("group_expenses").select("id").eq("id", expense.id)).data).toHaveLength(1);
  });

  await test.step("everyday edits still work", async () => {
    expect(
      (await asBina.from("group_members").update({ upi_id: "bina@okbank" }).eq("id", memberOf(bina.id))).error,
    ).toBeNull();
    expect((await asBina.from("groups").update({ name: "Flat 4B" }).eq("id", groupId)).error).toBeNull();
    expect((await asBina.from("group_expenses").update({ description: "Veg" }).eq("id", expense.id)).error).toBeNull();
    const { data: chen } = await asBina
      .from("group_members")
      .insert({ group_id: groupId, display_name: "Chen" })
      .select()
      .single();
    expect((await asBina.from("group_members").update({ display_name: "Chen L" }).eq("id", chen!.id)).error).toBeNull();
    // The owner can remove someone, and delete the group.
    expect(
      (await asAsha.from("group_members").update({ deleted_at: new Date().toISOString() }).eq("id", chen!.id)).error,
    ).toBeNull();
  });

  await test.step("deleting Bina's account still works and keeps her spot by name", async () => {
    const { error } = await admin().auth.admin.deleteUser(bina.id);
    expect(error).toBeNull();
    const spot = await member(bina.id);
    expect(spot.user_id).toBeNull();
    expect(spot.display_name).toBe("Bina");
  });

  await test.step("the owner can delete the group", async () => {
    expect(
      (await asAsha.from("groups").update({ deleted_at: new Date().toISOString() }).eq("id", groupId)).error,
    ).toBeNull();
  });
});
