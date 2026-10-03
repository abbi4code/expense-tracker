# Phase 5 — Backlog / Later Ideas

Parked ideas. Each is re-evaluated against real usage before it's promoted to a phase.

## Money features
- **Multi-currency**: per-expense currency with conversion to the home currency (FX rates cached daily). Great for travel.
- **Trips mode**: temporary budget + currency for a trip, auto-tags everything during those dates.
- **Savings goals**: "New phone ₹60,000 by March", with progress.
- **Accounts & balances**: track the balance per bank/card/wallet (moves toward a full finance app; be careful with scope).
- **Bank SMS / email / statement parsing**: auto-capture. High value but region-specific and privacy-heavy.

## Insight & delight
- **Year in review ("Wrapped")**: shareable, beautiful yearly summary.
- **AI assistant**: "How much did I spend on food on weekends last quarter?" (natural-language questions over your own data).
- **AI receipt scanning** (OCR → prefilled expense).
- **Anomaly detection**: "Electricity is 40% higher than usual."
- **Custom themes / accent colours / app icons**.

## Platform
- **Home-screen widgets**: not possible for PWAs today. Revisit if we ever wrap the app with Capacitor.
- **Capacitor/native wrapper** for app-store presence, widgets and better notifications, if the PWA hits limits.
- **Localization** (Hindi and other languages).
- **Public landing page + blog** (if it becomes a public product).

## Business (only if public)
- Freemium: core free forever; premium = receipts OCR, AI, unlimited groups, themes.
- Privacy policy, terms, analytics (privacy-friendly, e.g. Plausible/PostHog with consent).

## Built (2026-10-04)

Picked from real gaps rather than the list above. Migration `20261005…`: `favourites`, `profiles.notify_budgets / notify_settle`, `group_recurring_rules` (+ `group_expenses.recurring_rule_id`). Before it, `20261004…` locked down group permissions (only you change your UPI ID/name, only the owner removes members or deletes the group, no hard deletes).

- **Paste payment message**: "Paste" pill in the Add sheet reads the clipboard (iOS shows its own Paste bubble); falls back to a paste box. New parser (`src/lib/payment-message.ts`) tested on HDFC/SBI/ICICI/Axis/Kotak SMS and GPay/PhonePe/Paytm messages: amount (ignores balances/limits), payee (VPA, `UPI/P2M/…/NAME`, card "on/at"), the message's date, UPI/card, money received. Android share target uses it too.
- **Favourites**: row of tiles on Home under Quick add; one tap logs it for today (Undo toast). Pin from "You log these often" (same amount + category + note 3+ times in 90 days) or the ☆ Favourite pill when editing an expense. Long-press or "+" to reorder/remove. Fixed amounts only.
- **Budget alerts**: push at 80% and 100% of the overall and each category budget, once per level per period, 9am–9pm local; straight past 100% sends only "over". Also fixed the garbled over-budget text on Home.
- **Settle-up reminders**: push to whoever owes, after 14 days of owing (replayed from the group's history), then weekly at 10am. Never to the person owed.
- **Repeating group expenses** (monthly, e.g. rent): "Every month" switch in the group expense form; "Repeating" card on the group screen (edit future months, pause, stop; warns when someone in the split has left). Each member's app adds due months after sync with ids from (rule, date) and a new "create" outbox op (insert if missing), so a month is added once and a deleted month stays deleted.
- Tests: `tests/unit/*` and `tests/e2e/{groups,features}.spec.ts` (see `tests/README.md`).

Not built: favourites with a variable amount, weekly/yearly group repeats, a "Remind" button for the person owed.
Known: the Add sheet's Date and Note panels push the Add button below a 375×548 screen (Paste hides the pad instead).
