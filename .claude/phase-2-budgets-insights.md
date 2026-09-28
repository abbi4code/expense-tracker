# Phase 2 — Control & Awareness: Budgets, Recurring, Insights

**Goal:** Move from "what did I spend" to "am I on track, and what's coming".

**Done when:** The home screen tells you how much you can safely spend today, and upcoming bills never surprise you.

## Features

### 1. Budgets
- **Overall monthly budget** + optional **per-category budgets**.
- Progress rings/bars with calm colour states: on track → getting close (80%) → over. No alarming red walls.
- Budgets roll forward month to month automatically. Optional **rollover** of unspent amounts per category.

### 2. "Safe to spend" ⭐ (the new hero number)
- `(budget − spent − upcoming recurring bills this period) ÷ days left` = **"You can spend ₹640/day"**.
- Home hero toggles between **Spent** and **Safe to spend** (tap to switch; remembers the choice).
- This is the single most useful number for most users, so it gets the most design attention in this phase.

### 3. Recurring expenses (bills, subscriptions, EMIs, rent)
- Mark any expense as recurring: daily / weekly / monthly / yearly / custom day of month.
- **Upcoming** list: "Netflix · ₹649 · in 3 days".
- Auto-create the expense on the due date (Supabase cron / `pg_cron` or an Edge Function). It can be marked "auto-add" or "ask me first".
- **Subscriptions view:** total monthly cost of all subscriptions (often an eye-opener).

### 4. Income (optional per user)
- Toggle in settings. When enabled, the Add sheet gets an Expense | Income switch.
- Home shows **Income − Expenses = Saved this month**.
- Data model: add `kind enum('expense','income')` to `expenses` (or rename the table to `transactions` now, before there's much data).

### 5. Tags
- Free-form `#tags` on an expense (trips, projects, events). Autocomplete from existing tags.
- Tag view: total per tag. Good for "how much did the Goa trip cost?"

### 6. Search & filters
- Search notes, tags, categories and amounts (`>500`).
- Filters: date range, categories, payment methods, tags, kind. Filters can be combined and saved as quick views.

### 7. Insights tab
- Month vs previous month, by category (what went up or down, and by how much).
- Spending trend over 6/12 months (bar chart).
- Day-of-week / time-of-day pattern ("You spend most on Saturdays").
- Biggest expenses this month.
- Averages: per day, per week.
- Every chart has a one-line **plain-English takeaway** above it. Charts support the sentence, not the other way round.

## Data model additions

```
budgets          id, user_id, category_id null (null = overall), amount_minor, rollover bool
recurring_rules  id, user_id, template (amount, category, note, method…),
                 frequency, interval, day_of_month, next_due_on, mode ('auto'|'ask'), is_active
tags / expense_tags   (or a text[] column on expenses with a GIN index — simpler)
expenses.kind    'expense' | 'income'
expenses.recurring_rule_id null
```

- Move aggregation into **SQL views / RPC functions** (monthly totals by category, etc.) so the client stays light and fast.

## Built (2026-09-28)

- Migration `20260930…`: `budgets`, `recurring_rules`, `expenses.kind/tags/recurring_rule_id`, `categories.kind` (+3 income categories), `profiles.track_income`.
- Budgets (Settings → Budgets): overall + per category, calm ok/close/over meters (icon + words, not just colour).
- Home hero toggles **Safe to spend per day** ↔ Spent. Safe = (budget − spent − bills still due this period) ÷ days left, floored to whole units.
- Recurring: "Repeat" in the Add sheet (weekly/monthly/yearly). Occurrences are added **by the app after each sync** (not a server cron) with ids derived from `ruleId:date`, so devices never duplicate them. Rules can "ask first" (Home → Due now: Paid / Skip), be paused, edited or stopped. Home shows the next 7 days of bills; Settings → Recurring shows the monthly total.
- Income (Settings → Track income): Expense | Income switch in the sheet, income categories, "Income / Saved" on Home. Spending totals exclude income.
- Tags from `#hashtags` in notes (Unicode, incl. Hindi). Activity search: notes, category, `#tag`, `>500` / `<100`, payment-method filter.
- Insights: 6-month trend, what changed vs last period, per-category budget status, weekday pattern (90 days), biggest expenses, tag totals.
- Sync fix: merged outbox changes keep their queue position (versioned), so a rule is always pushed before its expenses.

Not built: budget rollover, saved filter views, time-of-day pattern.

## Out of scope

Push notifications (Phase 3). Alerts show in-app only for now.
