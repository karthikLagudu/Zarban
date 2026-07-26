# Deploying Zarban for free

Zarban runs on **Cloudflare Workers + D1**, both of which have a free plan that
comfortably covers this app (Workers: 100k requests/day; D1: generous free
storage/reads). Because the code uses `cloudflare:workers` and D1 directly, this
is the free host it runs on unmodified.

You need your **own free Cloudflare account** — the deploy has to run under your
login (an assistant can't create the account or sign in for you).

## One-time setup

```bash
# 1. Create a free account at https://dash.cloudflare.com  (no card required)

# 2. Install deps and authenticate wrangler (opens a browser)
npm install
npx wrangler login

# 3. Create a free D1 database and copy the "database_id" it prints
npx wrangler d1 create zarban

# 4. Load the schema + seed (578 questions, curriculum, staff accounts, …)
npx wrangler d1 execute zarban --remote --file=drizzle/0000_initial.sql
```

## Deploy

```bash
# 5. Build the Worker
npm run build

# 6. Point the built config at YOUR D1, then deploy.
#    Edit dist/server/wrangler.json → d1_databases[0].database_id = <id from step 3>
cd dist/server && npx wrangler deploy
```

Wrangler prints the live URL (e.g. `https://zarban.<your-subdomain>.workers.dev`).

## After it's live

```bash
# Set a strong session secret (there's a dev fallback, but override it in prod)
npx wrangler secret put AUTH_SECRET
```

Then **change the default staff passwords** by signing in at `/admin/login`
(`admin@zarban.local` / `admin123`) and using **User Access** to reset them.

## Redeploying later

Repeat steps 5–6 after any change. The D1 already holds your data, so you only
re-run the migration (step 4) if the schema changed — and then use the
migrations in `drizzle/` rather than replaying the seed over live data.

> Note: `vinext deploy` also exists and wraps wrangler, but it is tuned for the
> managed hosting platform; the plain `wrangler deploy` path above is the
> reliable one for your own Cloudflare account.
