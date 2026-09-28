# Phase 3 — Habits & Smart Input

**Goal:** Make logging even easier and help the user keep the habit, without being annoying.

**Done when:** You rarely forget to log. When you do, the app nudges you once, nicely.

## Features

### 1. Web push notifications
- **Daily log reminder** at a user-chosen time, skipped if they already logged today.
- **Bill due** reminders (from recurring rules).
- **Budget nudges** at 80% / 100% of a category budget (max 1 per category per period).
- **Weekly recap** (Sunday evening): "You spent ₹8,200 this week, 12% less than last week."
- Every type can be toggled individually. Quiet hours.
- ⚠️ iOS supports web push **only for installed PWAs (iOS 16.4+)**, and only after a user tap grants permission. Ask at a meaningful moment ("Remind me to log daily?"), never on first load.
- Implementation: VAPID keys, `push_subscriptions` table, sending from a Supabase Edge Function + scheduled cron.

### 2. Quick text input
- Type `coffee 120` or `uber 340 yesterday` and it parses into amount + category (from learned note→category history) + date.
- Rule-based parser first (fast, offline). An AI-assisted parse can be considered later.

### 3. Receipts
- Attach a photo to an expense (camera or gallery). Compressed on the client, stored in **Supabase Storage** (private bucket, RLS by user).
- Receipt thumbnail in the list and full view in the detail screen.
- *Later:* OCR / AI to pre-fill amount and merchant from the photo.

### 4. Share to app (Android)
- `share_target` in the manifest: share a receipt image or a payment-confirmation text to the app, and it opens the Add sheet prefilled.
- (iOS doesn't support share targets for PWAs.)

### 5. Reimbursable expenses
- Flag an expense as "to be reimbursed", then mark it reimbursed later.
- The Reimbursable view shows how much you're still owed. It is optionally excluded from personal spending totals.

### 6. Export & import
- **Export CSV** (and JSON) for any date range. It's your data.
- **Import CSV** from other apps / bank statements, with column mapping and a preview before importing.

### 7. Streaks & gentle gamification (optional)
- "Logged 12 days in a row". A subtle flame or dot calendar on the Activity tab.
- Nothing that guilt-trips the user when a streak breaks.

### 8. App lock (optional)
- Lock the app with a device passkey / biometrics (WebAuthn) or a PIN when it opens. Useful because spending data feels private.

## Built (2026-09-28)

- Migration `20261001…`: `expenses.reimbursable/reimbursed_at/receipt_path`, notification prefs + `timezone` on profiles, `push_subscriptions`, `notification_log`, private `receipts` storage bucket (per-user folder policies).
- **Quick add** on Home (`src/lib/quick-entry.ts`): amount (`1.5k`, `2l`, `₹450`), dates (yesterday, "3 days ago", weekdays), payment method, category from exact name → your past notes → built-in keywords (zomato, uber, blinkit…). Saves straight away when amount + category are known; otherwise opens the sheet prefilled.
- **Share target** (Android): shared SMS/UPI text → prefilled Add sheet (`parseSharedText`).
- **Work expenses**: "Work expense" pill; excluded from spending, budgets and Insights; Home "to claim back" card → `/activity?claim=1` → "Mark paid back".
- **Receipts**: compressed to ≤1600px JPEG on the phone, uploaded after save, thumbnail in the pill, signed URLs.
- **Streak** chip on Home (from 2 days).
- **Export** CSV / full JSON backup (share sheet on phones); **import** CSV with column mapping, date-format guess, preview. The sync engine now batches up to 200 same-shape rows per request.
- **Push notifications**: daily reminder (only if nothing logged), bills due today/tomorrow (9am), Sunday recap (7pm), in each user's time zone, at most once each (`notification_log`). Scheduler: `GET /api/notifications/run` (Bearer `CRON_SECRET`, `?dryRun=1`). Needs a deployed URL + a cron (see README).

Not built: AI receipt OCR, sharing images (receipts) into the app, app lock (passkey/PIN).

## Out of scope

Shared/split expenses (Phase 4).
