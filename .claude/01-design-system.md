# Design System & UX Direction

The UI is the product. This doc sets the rules so every screen feels like the same app.

## Proposed aesthetic: "Calm & tactile"

A soft, warm, uncluttered look where the **numbers are the hero**. It should feel like a well-made physical object, not a dashboard.

- **Background:** warm off-white (`#F6F4EF`-ish) in light mode, deep near-black (`#0E0E10`) in dark mode. Not pure white, not pure black.
- **Ink:** one near-black text colour. Muted grey for secondary text.
- **One accent colour** for primary actions and focus (e.g. a confident lime, electric violet, or tangerine; to be decided with mockups).
- **Category colours:** soft pastel chips with matching emoji or icon. Every category gets a colour, used consistently in lists, charts and budgets.
- **Big numerals:** the monthly total / safe-to-spend is shown very large (48–64px), using **tabular numbers** so digits don't jump while animating.
- **Rounded, soft surfaces:** 20–28px radius cards, subtle borders or very soft shadows. No heavy drop shadows or gradients everywhere.
- **Dark mode** is a first-class theme, not an afterthought. It follows the system by default and can be overridden in settings.

> Alternatives to consider when mocking up: **"Bold & playful"** (saturated colour blocks, chunky type, Gen-Z energy) or **"Minimal mono"** (black/white + one accent, very typographic). We'll mock the home screen in 2–3 directions before locking one in.

### Typography

- One UI sans with good tabular figures (candidates: Geist, Satoshi, General Sans, Manrope).
- Optional display face for big amounts / headings to give it personality.
- Minimum 16px on inputs (prevents iOS zoom-on-focus).

## Layout & navigation (mobile)

```
┌──────────────────────────┐
│  Header: month switcher  │  ← swipe/tap to change month
│                          │
│   ₹ 12,480               │  ← hero number (spent / safe-to-spend)
│   ▁▂▅▃▆▂ mini trend      │
│                          │
│  Category chips / budget │
│  Recent transactions     │  ← grouped by day, swipe to delete/edit
│                          │
│                  ( + )   │  ← FAB in thumb zone, bottom-right
├──────────────────────────┤
│ Home  Activity  Insights  Settings │  ← bottom tab bar
└──────────────────────────┘
```

- **Bottom tab bar** with 3–4 tabs max. Nothing important at the top of the screen (hard to reach with a thumb).
- **Add expense = bottom sheet**, not a new page. It opens instantly over the current screen and swipes down to dismiss.
- **Desktop:** the same app in a centered column, or a two-pane layout (list + detail). No separate desktop design until later.

## The "Add expense" sheet (most important screen in the app)

1. Sheet opens with a **custom on-screen number pad** already focused (no system keyboard popping up).
2. Amount display is big at the top. Supports simple maths (`120+45`).
3. **Category row:** horizontally scrollable chips, sorted by *most used*. The last-used one is preselected.
4. Optional row: note · date (defaults to "Today"; "Yesterday" is one tap) · payment method.
5. Big **Save** button. It gives haptic-style feedback (a visual pulse; vibration where supported) and the sheet closes. An "Added ₹120 · Food · Undo" toast appears.
6. Long-press Save = "Save & add another".

Target: **open → type amount → tap category → save** in under 5 seconds.

## Interaction rules

- **Everything responds in < 100ms.** Use optimistic UI. Never block on the network.
- **Undo instead of confirm dialogs.** Deleting shows an undo toast, not "Are you sure?".
- **Swipe gestures** on list rows: left = delete, right = edit/duplicate. There must always be a tap alternative too.
- **Motion:** short (150–250ms) spring animations for sheets, number count-ups, and list inserts. Respect `prefers-reduced-motion`.
- **Skeletons, not spinners.** Show cached data first, then refresh quietly.
- **Empty states are friendly and actionable** (illustration or emoji + one clear button). No blank screens.

## Native-feel PWA checklist

- `display: standalone`, themed status bar (`theme-color` for light/dark), proper icons + maskable icon, iOS splash screens.
- `viewport-fit=cover` + `env(safe-area-inset-*)` padding for the notch and home indicator.
- Use `100dvh`, not `100vh` (mobile browser toolbar issue).
- Disable text selection / tap highlight on UI chrome. Keep it on content.
- Prevent pull-to-refresh / overscroll bounce where it breaks the app feel (`overscroll-behavior`).
- `inputmode="decimal"` wherever a system keyboard is used for amounts.
- Custom **"Install app" prompt**: Android uses `beforeinstallprompt`. iOS needs an illustrated "Share → Add to Home Screen" sheet because iOS has no install API.
- **Home-screen shortcuts** (manifest `shortcuts`): "Add expense" on long-press of the app icon (Android + desktop; iOS doesn't support these).

## Accessibility

- Colour contrast AA minimum. Category colour is never the *only* signal (always paired with an icon or label).
- Tap targets ≥ 44×44px.
- Screen-reader labels on the number pad, chips and charts (charts get a text summary).
- Full keyboard support on desktop.

## Suggested UI stack

- **Tailwind CSS** + design tokens as CSS variables (colours, radius, spacing) for themes.
- **shadcn/ui** (Radix) as unstyled-ish primitives, heavily restyled to match our look.
- **Vaul** for bottom-sheet drawers.
- **Motion** (Framer Motion) for transitions and number animations.
- **Recharts** or **visx** for charts (decide in Phase 2).
- **Lucide** icons + emoji for categories.

## Before building UI

- [ ] Mock the **Home** and **Add expense** screens in 2–3 directions.
- [ ] Pick the direction, accent colour and font.
- [ ] Define tokens (colours light/dark, radii, spacing scale, type scale) in one file.
