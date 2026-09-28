# Expense Tracker — Planning Docs

Planning docs for a mobile-first, installable (PWA) expense tracker built with **Next.js + Supabase**.

Read in this order:

| File | What it covers |
|------|----------------|
| [00-product-vision.md](00-product-vision.md) | Who it's for, what they actually need, principles, non-goals, open questions |
| [01-design-system.md](01-design-system.md) | UI/UX direction — look & feel, layout, interaction rules, PWA polish |
| [phase-0-foundation.md](phase-0-foundation.md) | Project setup, auth, PWA shell, data model, offline groundwork |
| [phase-1-mvp.md](phase-1-mvp.md) | Log expenses fast, see where money went — the smallest app worth installing |
| [phase-2-budgets-insights.md](phase-2-budgets-insights.md) | Budgets, "safe to spend", recurring bills, income, insights, search |
| [phase-3-habits-and-smart-input.md](phase-3-habits-and-smart-input.md) | Reminders, push, receipts, quick text input, export/import |
| [phase-4-shared-expenses.md](phase-4-shared-expenses.md) | Shared wallets, splitting with friends, settle up |
| [phase-5-backlog.md](phase-5-backlog.md) | Ideas parked for later |

## Status

- [x] Product vision reviewed (audience + auth decided)
- [ ] Design direction picked (Phase 0 ships the proposed "Calm & tactile" tokens)
- [x] Phase 0
- [x] Phase 1 (MVP): see "Built" notes in phase-1-mvp.md
- [x] Phase 2: see "Built" notes in phase-2-budgets-insights.md
- [x] Phase 3: see "Built" notes in phase-3-habits-and-smart-input.md
- [x] Phase 4: see "Built" notes in phase-4-shared-expenses.md

## Rules of thumb for every phase

1. **Adding an expense must take under 5 seconds** from tapping the home-screen icon. Any feature that slows this down is rejected or hidden.
2. **Mobile first, thumb first.** Design at 390px wide first. Desktop is a nice-to-have layout of the same app.
3. **Works offline.** Logging never fails because of bad signal.
4. **Each phase ships something usable.** No phase is only "backend work".
