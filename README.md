# Expense

A mobile-first expense tracker, built to live on your phone's home screen as a PWA.
Next.js 16 (App Router) + Supabase + Tailwind v4.

Product plan and phases: [`.claude/README.md`](.claude/README.md).

## Local setup

Needs Node 20+, Docker (running) and the Supabase CLI.

```bash
npm install
supabase start                 # local Postgres, Auth, Studio, Mailpit
cp .env.example .env.local     # then fill in the values below
npm run dev                    # http://localhost:3000
```

Fill `.env.local` from `supabase status`:

- `NEXT_PUBLIC_SUPABASE_URL`: the API URL (`http://127.0.0.1:54321`)
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: the publishable (or anon) key

Local emails (password-reset links) are caught by **Mailpit** at http://127.0.0.1:54324.
Supabase Studio is at http://127.0.0.1:54323.

### Hosted Supabase project

```bash
supabase login                                   # with the account that owns the project
npm run db:link -- --project-ref <project-ref>   # asks for the database password
npm run db:push                                  # applies supabase/migrations to the hosted DB
```

Then in the dashboard (these live in `supabase/config.toml` locally but are **not** pushed by `db:push`):

- **Authentication → Sign In / Providers → Email**: turn **Confirm email OFF** (signup logs straight in). Minimum password length 8, "letters and digits".
- **Authentication → URL configuration**: site URL + redirect URL `http://localhost:3000/auth/callback` (add `<your-domain>/auth/callback` once deployed). Needed for password-reset links.
- **Authentication → SMTP** (later): the built-in mailer only sends ~2 emails an hour. Only password resets send email now, but set up custom SMTP (e.g. Resend) before going public.

### Google sign-in (optional locally)

1. Google Cloud Console → Credentials → OAuth client ID (Web application).
   Authorised redirect URI: `http://127.0.0.1:54321/auth/v1/callback` (for production, use your Supabase project URL + `/auth/v1/callback`).
2. Put the ID and secret in `supabase/.env` (git-ignored):
   ```
   SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID=...
   SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET=...
   ```
3. Set `enabled = true` under `[auth.external.google]` in `supabase/config.toml`, then `supabase stop && supabase start`.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server (service worker disabled; `NEXT_PUBLIC_SW_IN_DEV=1` to enable) |
| `npm run build && npm start` | Production build, with the service worker on |
| `npm run lint` | ESLint |
| `npm run db:types` | Regenerate `src/lib/supabase/database.types.ts` from the local DB |
| `npm run db:link` / `npm run db:push` | Link the hosted project / push migrations to it |
| `npm run tunnel` | Public HTTPS URL for localhost:3000 (Cloudflare quick tunnel) |
| `npm run icons` | Regenerate app icons from `scripts/generate-icons.mjs` |
| `supabase migration new <name>` | New SQL migration in `supabase/migrations` |
| `supabase db reset` | Rebuild the local DB from migrations |

## Notifications (web push)

1. `.env.local` already has generated VAPID keys and a `CRON_SECRET`. Also set:
   - `VAPID_SUBJECT`: a real `mailto:` address or your site URL (Apple rejects placeholders).
   - `SUPABASE_SECRET_KEY`: Supabase dashboard → Project Settings → API keys → secret key. Server-only.
2. Deploy, then call the scheduler **every 30 minutes** (it sends at each user's local hour; 30 min covers
   half-hour time zones like India). With Supabase's built-in cron (Database → Extensions: enable
   `pg_cron` and `pg_net`), run once in the SQL editor:
   ```sql
   select cron.schedule('expense-notifications', '*/30 * * * *', $$
     select net.http_get(
       url := 'https://YOUR-APP-DOMAIN/api/notifications/run',
       headers := jsonb_build_object('Authorization', 'Bearer YOUR_CRON_SECRET')
     );
   $$);
   ```
   (Or any external cron, e.g. cron-job.org, hitting the same URL with that header.)
3. Try it: `curl -H "Authorization: Bearer $CRON_SECRET" "https://YOUR-APP-DOMAIN/api/notifications/run?dryRun=1"`
   shows what would be sent without sending.

iPhone: notifications only work in the installed home-screen app (iOS 16.4+).

## Testing on your phone

```bash
npm run dev        # terminal 1
npm run tunnel     # terminal 2: prints a public https://….trycloudflare.com URL
```

Open that URL on your phone. It forwards to your laptop's localhost, so edits hot-reload on the phone too.

- The URL changes every time the tunnel restarts. A PWA added to the home screen is tied to one URL, so re-add it after a restart (or deploy to Vercel for a permanent link).
- For password-reset links, add `https://*.trycloudflare.com/**` to Supabase → Authentication → URL Configuration → Redirect URLs.
- The service worker (offline, install prompt) only runs in production: use `npm run build && npm start` instead of `npm run dev` to test those.

## How it stays fast

- **Static app shell.** Everything under `src/app/(app)` is prerendered: no server work or Supabase
  query per page, so tabs switch from the client cache (≈50–100ms on a phone). Signed-out visitors
  are redirected by `src/proxy.ts`; first-run setup is checked on the client in `DataProvider`.
- **Local-first data.** Screens read IndexedDB (Dexie); `SyncEngine` pushes the outbox and pulls all
  tables **in parallel**, then writes them parent-before-child.
- **Instant open.** The service worker serves app screens you've visited from cache and refreshes
  them in the background (`public/sw.js`); a new deploy clears those caches when it activates.
- **Account on the device.** `src/lib/session-cache.ts` remembers which account's local data to open,
  so the app starts without waiting for the network; Supabase confirms the session in the background.

## Project layout

```
src/
  app/
    page.tsx              public landing page
    (auth)/               login, signup, verify, forgot-password
    (app)/                signed-in app: home, activity, insights, settings (+ tab bar, FAB)
    auth/callback/        OAuth code exchange
    manifest.ts           PWA manifest
  components/ui/          design-system primitives (Button, Sheet, Card, Chip…)
  components/app|auth|settings/
  lib/supabase/           browser/server clients + session proxy
  lib/pwa/                install-prompt store
  proxy.ts                session refresh + route guards (Next 16's "middleware")
public/sw.js              service worker
supabase/migrations/      database schema + RLS
```
