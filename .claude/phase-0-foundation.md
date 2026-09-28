# Phase 0 — Foundation

**Goal:** An installable, authenticated, empty app shell that looks and feels right on a phone. Every later phase builds on this.

**Done when:** You can install it on your phone's home screen, sign in, see the themed tab layout, and it opens offline (to the shell, at least).

## 1. Project setup

- Next.js (latest, App Router, TypeScript strict) + Tailwind.
- ESLint + Prettier, absolute imports (`@/`).
- Env handling for Supabase keys (`.env.local`, never commit secrets).
- Deploy to Vercel from day one (preview deploys per branch). You need HTTPS to test the PWA on a real phone.
- Supabase project + **Supabase CLI** with local dev and SQL migrations checked into git (`supabase/migrations`).
- Generated DB types (`supabase gen types`) so queries are type-safe.

## 2. Authentication (Supabase Auth)

- **Email + password** (manual signup) and **Sign in with Google**.
  - Signup = name + email + password + confirm password → signed in immediately (Supabase "Confirm email" is **off**, so no email is sent and there are no email rate limits).
  - Forgot password → reset link by email → `/auth/callback` → `/reset-password` (new password + confirm).
  - ⚠️ On iOS an email link opens Safari, not the installed PWA, so the reset happens in Safari. After that the user logs in to the app with the new password. Expired or reused links show a friendly message on the login screen.
  - If "Confirm email" is ever turned back on, the app still works: signup shows a "check your email" screen.
  - Passwords: minimum 8 characters, letters + digits (enforced by Supabase config and mirrored in the UI).
  - Test the Google OAuth redirect in iOS standalone mode early. It's a known rough edge.
- Long-lived sessions (users should almost never see the login screen again).
- `@supabase/ssr` for cookie-based sessions in server components and middleware.
- Protected routes; logged-out users see the landing page, logged-in users go to the app.

## 3. PWA shell

- Web app manifest: name, short_name, icons (incl. maskable), `display: standalone`, `theme_color`, `background_color`, `start_url`, `shortcuts` (Add expense).
- Apple-specific meta: `apple-touch-icon`, `apple-mobile-web-app-capable`, status bar style, splash images.
- Hand-written service worker (`public/sw.js`), as the Next.js PWA guide recommends. Serwist's webpack plugin doesn't fit Next 16's Turbopack builds.
  - Cache-first for hashed `/_next/static` assets, network-first for pages (with a cached fallback), stale-while-revalidate for images and fonts.
  - Self-contained `offline.html` fallback.
  - Registered as `/sw.js?v=<build id>`, so every deploy installs a new worker → "A new version is ready · Refresh" toast.
  - Disabled in `next dev` (set `NEXT_PUBLIC_SW_IN_DEV=1` to test it locally).
- Custom install prompt component (Android `beforeinstallprompt` + iOS instruction sheet). Shown after the user has logged a couple of expenses, not on first visit.

## 4. App shell & design tokens

- Tokens from `01-design-system.md` as CSS variables. Light/dark/system theme.
- Layout: safe-area aware, bottom tab bar (Home · Activity · Insights · Settings), placeholder pages.
- Base components: Button, Sheet (bottom drawer), Toast (with undo action), Chip, Card, Skeleton, EmptyState.
- Fonts self-hosted via `next/font`.

## 5. Data model (initial)

All money is stored as **integer minor units** (paise/cents, `bigint`), never floats.

```
profiles
  id (= auth.users.id), display_name, currency (ISO 4217, e.g. 'INR'),
  locale, month_start_day (1–28, default 1), week_start (0|1),
  theme, created_at

categories
  id uuid, user_id, name, emoji, color, sort_order,
  is_archived, created_at
  -- seeded with defaults on signup

payment_methods
  id uuid, user_id, name, icon, is_archived, created_at
  -- seeded: Cash, Card, UPI/Bank (depending on region)

expenses
  id uuid (generated on client → safe offline retries),
  user_id, amount_minor bigint (> 0), currency,
  category_id, payment_method_id null, note text null,
  spent_on date,              -- the user's local date (no timezone bugs)
  created_at timestamptz, updated_at timestamptz,
  deleted_at timestamptz null -- soft delete (enables undo + sync)
```

- **Row Level Security on every table:** `user_id = auth.uid()` for all operations. `user_id` defaults to `auth.uid()`.
- Indexes: `(user_id, spent_on desc)`, `(user_id, category_id)`.
- A trigger creates the profile + default categories on signup.

## 6. Offline groundwork (moved to the start of Phase 1)

> Built together with the Add-expense flow, where it can actually be tested end to end.


- The **client generates UUIDs** for new rows, so a retried write can't create a duplicate.
- Local store in **IndexedDB (Dexie)**: a cache of recent expenses/categories plus an **outbox queue** of pending writes.
- Sync: flush the outbox when back online or when the app is foregrounded. Last-write-wins using `updated_at` (enough for single-user).
- TanStack Query for server state, hydrated from IndexedDB for instant loads.



## Out of scope

Any real feature screens. Those start in Phase 1.
