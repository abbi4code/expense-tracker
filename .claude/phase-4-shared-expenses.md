# Phase 4 — Shared Expenses & Splits

**Goal:** Track money with other people: a partner, flatmates, trip friends.

**Done when:** A group of friends on a trip can log shared costs and see a single "who pays whom" settle-up.

> This is effectively a second product (multi-user data, invites, permissions, conflict handling). It gets its own detailed design before building.

## Features

### 1. Shared wallets / groups
- Create a group ("Flat 4B", "Goa Trip 2027", "Us"), then invite by link or email.
- Members see and add group expenses. Personal expenses stay private.
- Roles: owner / member.

### 2. Split an expense
- When adding: "Paid by [me / member]" + "Split: equally / exact amounts / percentages / shares".
- Your **share** counts toward your personal spending and budgets, not the full amount you paid.

### 3. Balances & settle up
- Per group: who owes whom, with **simplified debts** (minimum number of transfers).
- "Settle up" records a payment between two members.
- Optional: deep link to a payment app (e.g. UPI intent link) to actually pay.

### 4. Activity feed & notifications
- "Rahul added Dinner · ₹2,400 · you owe ₹600" (push, if enabled).
- Comments on an expense (optional).

### 5. Non-registered members
- Add people by name only (they don't need an account). They can claim their spot later via invite.

## Technical notes

- New tables: `groups`, `group_members`, `group_expenses` / `expense_splits`, `settlements`.
- RLS moves from `user_id = auth.uid()` to "is a member of this group". Test this carefully.
- Supabase **Realtime** to update group views live.
- Offline sync for shared data needs stricter conflict handling than last-write-wins (e.g. server-authoritative edits with version checks).

## Built (2026-09-28)

- Migrations `20261002…`: `groups`, `group_members` (accounts or named placeholders), `group_expenses` (splits as JSONB in the row, validated by trigger: members of the group, sum = amount), `settlements`, `expenses.group_expense_id`, `profiles.notify_groups`.
- RLS: everything keyed on `is_group_member()`. Accounts join only via `join_group()` (claim a named spot or join new); a trigger stops clients from reassigning a member's account (account deletion still works via the FK's SET NULL). `create_group`, `group_preview` (by invite code), `leave_group` are security-definer RPCs.
- Sync: groups + members pulled in full each time (RLS returns exactly your groups; leaving/joining is immediate); group expenses/settlements incremental, cursors reset when your set of groups changes. Group/member rows use insert/update outbox ops (not upsert) to fit RLS.
- **Your share → personal expense**: deterministic id per (group expense, user), created/updated/deleted by each user's app after sync; category guessed from the description. Budgets, Insights and safe-to-spend count only your share.
- Splits: equal / exact / percent / shares, exact to the paisa (largest remainder). Balances + greedy debt simplification. Settle-up records a payment; "Pay via UPI" deep link when the payee added a UPI ID (INR).
- UI: Groups tab (totals + per-group balance), new-group sheet (friends by name), group screen (timeline, balances, suggested payments, invite prompt), members & settings (invite link, add by name, UPI ID, rename, leave, delete), `/join/<code>` with sign-in `?next=` round trip.
- Notifications: "Rahul added Dinner ₹2,400 · your share ₹600" (or "N new expenses") via the scheduler, once per expense.

Not built: realtime live updates (groups refresh on open/focus/every minute), comments on expenses, multi-currency groups, removing someone else from a group.
