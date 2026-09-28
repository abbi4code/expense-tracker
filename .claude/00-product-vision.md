# Product Vision

## One-liner

A beautiful expense tracker you open from your home screen, log a spend in 3 taps, and actually keep using.

## The real problem

Most people *try* expense trackers and quit within 2 weeks. Why they quit:

| Why people quit | What we do about it |
|-----------------|---------------------|
| Logging takes too long (forms, dropdowns, keyboards) | Custom number pad opens instantly; category is one tap; date defaults to today |
| They forget to log | Gentle daily reminder, "log from home-screen shortcut", recurring expenses auto-added |
| The data doesn't tell them anything useful | Home screen answers "how much can I still spend?" instead of showing raw lists |
| Too much setup (accounts, budgets, categories) before first use | Zero setup: sensible default categories, first expense within 30s of signup |
| It's ugly / feels like a spreadsheet | UI-first product; it should feel like a native app |
| No signal → failed save → lost trust | Offline-first; saves locally, syncs later |

## Who it's for

- **Primary:** an individual tracking their own day-to-day spending on their phone. They are not an accountant, and they want awareness more than precision.
- **Secondary (Phase 4):** couples, flatmates, and friends on trips who share costs.

## What users actually need (in priority order)

1. **Capture:** "I just spent money, let me note it before I forget." (fast, offline, one hand)
2. **Awareness:** "How much have I spent this month? Am I okay?"
3. **Control:** "I want to spend max X on food." (budgets, alerts)
4. **Predictability:** "What bills are coming up?" (recurring: rent, subscriptions, EMIs)
5. **Reflection:** "Where did my money go? Am I better than last month?" (insights)
6. **Sharing:** "Who owes whom?" (splits)

The phases follow this order.

## Expense "types" — how we model them

"Different types of expense" means several separate things. Each one is its own feature, not a single dropdown:

| Dimension | Examples | Phase |
|-----------|----------|-------|
| **Category** (what it was for) | Food, Transport, Shopping, Bills, Health, Fun, custom… | 1 |
| **Payment method** (how it was paid) | Cash, Card, UPI, Bank transfer, custom… | 1 (optional field) |
| **Tags** (free-form context) | #trip-goa, #office, #gift | 2 |
| **Recurrence** | One-time (default) vs recurring (rent, Netflix, EMI) | 2 |
| **Direction** | Expense (default) vs Income | 2 |
| **Reimbursable** | Work expense to claim back | 3 |
| **Shared / split** | Paid for a group, split among people | 4 |

## Product principles

1. **Speed over completeness.** Only the amount is required. Everything else is optional or defaulted.
2. **Answers, not data.** Every screen answers a question the user has.
3. **Calm, not guilt.** No red screaming alerts. Spending over budget gets a gentle, factual nudge.
4. **Feels native.** Standalone PWA, smooth transitions, bottom sheets, no browser-y chrome.
5. **Private by default.** The user owns their data. It can be exported and deleted any time.

## Non-goals (for now)

- Bank account / SMS auto-import (complex, region-specific, privacy-heavy). Maybe later.
- Investments, net worth, stock tracking.
- Accounting-level double-entry bookkeeping.
- Native iOS/Android apps. The PWA is the product.

## Success criteria

- A new user logs their first expense **within 30 seconds** of signing up.
- Adding an expense takes **≤ 3 taps + typing the amount**.
- The installed PWA opens to an interactive screen in **< 1.5s** on a mid-range phone.
- **Lighthouse PWA/perf/a11y ≥ 90** on mobile.
- Personal goal: *you* use it every day for a month without forcing yourself.

## Decisions

- ✅ **Audience:** private beta for the owner + friends first. It goes public once everyone is happy, so we build to public quality (RLS, account deletion, privacy) from day one but skip marketing/scale work until then.
- ✅ **Sign-in:** simple email + password (with confirm password) **and** Google. No email confirmation at signup: you're signed in straight away. Forgot password sends a reset link.

## Assumptions (please confirm or correct)

- [ ] Personal tracking first; shared expenses in Phase 4.
- [ ] One currency per user (picked at onboarding); multi-currency later.
- [ ] Free, no monetisation in early phases.
- [ ] English only at first, but amounts/dates are locale-formatted from day one.

## Open questions

1. ~~Just you and friends, or public?~~ Answered: friends first, public later.
2. Which **currency/region** matters most first? (Affects defaults like UPI as a payment method.)
3. Do you care about **income tracking**, or only spending?
4. Should the **month start on the 1st**, or on a custom day (e.g. salary day)? *(Planned as a setting in Phase 1.)*
5. Any apps whose look you love? (Helps lock the design direction in `01-design-system.md`.)
