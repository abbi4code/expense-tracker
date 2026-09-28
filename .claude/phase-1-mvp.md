# Phase 1 — MVP: Log fast, see where it went

**Goal:** The smallest app you'd actually keep on your home screen and use daily.

**Done when:** You've used it on your phone for a week to log every expense, including some with no internet, and never felt it was slower than a notes app.

## Features

### 0. Offline data layer (carried over from Phase 0)
- Dexie (IndexedDB) cache + outbox queue, client-generated UUIDs, sync on reconnect/foreground. See phase-0 §6.
- Generate DB types (`npm run db:types`) and type all Supabase queries.

### 1. Onboarding (≤ 30 seconds)
- Sign in → pick **currency** (suggested from locale) → optional **month start day** → straight to the Add sheet with a hint: "Log your first expense".
- Default categories are already there. No other setup.

### 2. Quick add expense ⭐ (the core of the app)
- FAB on every main screen, plus the home-screen shortcut, opens the **Add sheet** (see design doc).
- Custom number pad, simple maths (`120+80`), big amount display.
- Category chips sorted by frequency; last used preselected.
- Optional: note, date (Today / Yesterday / pick), payment method.
- Save → optimistic insert → "Added · Undo" toast.
- **Works offline**: saves to IndexedDB, shows a subtle "syncing" dot until confirmed.
- Smart default: if a note matches a previous one (e.g. "Uber"), suggest that entry's category.

### 3. Home screen — "How am I doing this month?"
- Month switcher (swipe or arrows). The period respects `month_start_day`.
- **Hero number:** total spent this period (animated count-up).
- Comparison line: "₹2,300 less than this time last month" (calm, factual).
- Top categories as colour bars/chips with amounts.
- Last ~5 transactions + "See all".

### 4. Activity (transaction list)
- Infinite list grouped by day, with a daily total in each day header.
- Tap → edit sheet (same UI as Add). Swipe left → delete (with undo). Swipe right → duplicate ("had this again").
- Filter by category (chips at the top) and month.

### 5. Categories
- Default set: Food & Drinks, Groceries, Transport, Shopping, Bills & Utilities, Rent, Health, Entertainment, Travel, Education, Personal Care, Gifts, Other.
- Create / rename / change emoji & colour / reorder / archive (archived ones stay on old expenses).
- Deleting a category with expenses asks: "move them to…".

### 6. Payment methods (optional field)
- Defaults: Cash, Card, UPI / Bank transfer. Editable list.
- Hidden from the Add sheet if the user turns it off in settings (less clutter).

### 7. Simple breakdown
- On Home or its own tab: a **donut or stacked bar by category** for the selected month. Tap a category → filtered Activity list.

### 8. Settings
- Profile (name), currency, month start day, week start, theme (system/light/dark).
- Manage categories & payment methods.
- Toggle optional fields on the Add sheet.
- Sign out. **Delete account & all data** (required for trust).

### 9. PWA polish
- Install prompt (after 2–3 logged expenses).
- Update-available toast.
- Offline banner only when relevant ("You're offline, entries will sync").

## Acceptance checklist

- [ ] Add expense in ≤ 3 taps + amount, measured on a real phone.
- [ ] Add/edit/delete works in airplane mode and syncs later without duplicates.
- [ ] App opens to cached data instantly (no blank screen, no spinner on the home screen).
- [ ] Looks right on iPhone (notch + home indicator) and Android, in light and dark.
- [ ] RLS verified: user A can never read or write user B's data.
- [ ] Lighthouse mobile ≥ 90 across the board.

## Built (2026-09-28)

- Offline-first data layer: Dexie DB per user (`src/lib/db/`) + outbox, pushed in order and pulled incrementally by `updated_at`. Soft deletes everywhere (categories/payment methods got `deleted_at` in migration `20260929…`).
- Onboarding (`/welcome`): currency guessed from the device locale, month start day.
- Add/Edit sheet: number pad with + / −, category chips by usage (last used preselected, note → category suggestion), date / payment / note pills, Undo toast, desktop keyboard input.
- Home (month total, vs-last-month, top-4 category bar + legend, install card after 3 expenses, recent), Activity (month switcher, category filter, grouped by day, swipe delete/duplicate), Insights (ranked category bars + takeaway), Settings (name, currency, month start, categories with reorder/hide/delete-and-move, payment methods, payment-row toggle, theme, sign out wiping device data, delete account RPC).
- The service worker pre-caches all tabs after sign-in.

Not done from this list: long-press "Save & add another", week-start setting (nothing uses it yet).

## Out of scope (moved to later phases)

Budgets, recurring, income, tags, search, charts beyond the breakdown, notifications, receipts, export.
