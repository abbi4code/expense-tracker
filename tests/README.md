# Tests

Playwright runs both kinds:

- `npm test`: unit tests in `tests/unit` (pure logic, no server needed).
- `npm run test:e2e`: phone-sized browser tests in `tests/e2e`, with real accounts on the **local** Supabase.

## Running the e2e tests

They create users through the admin API, so never point them at the hosted project.

```bash
supabase start -x vector,realtime,edge-runtime,studio,postgres-meta,supavisor,imgproxy
eval "$(supabase status -o env | grep -E '^(API_URL|PUBLISHABLE_KEY|SECRET_KEY)=' | sed 's/^/export /')"

# terminal 1: the app against the local Supabase, on its own port
NEXT_PUBLIC_SUPABASE_URL=$API_URL NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$PUBLISHABLE_KEY \
  SUPABASE_SECRET_KEY=$SECRET_KEY npx next dev -p 3100

# terminal 2
npm run test:e2e        # E2E_BASE_URL defaults to http://localhost:3100
```

`next dev` won't start a second server in the same folder, so stop your usual dev server first (or run
this from a copy of the repo).
