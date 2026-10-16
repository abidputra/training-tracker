# Training Tracker

Multi-user PWA that pulls training data from **Strava** (OAuth + push webhooks) and **Garmin** (login + polling) into one live page.

```
Strava ──webhook──► Supabase Edge Function ─┐
                                            ├─► Postgres ──Realtime──► React PWA
Garmin ◄──poll── Garmin service (Python) ───┘
         ▲ pg_cron every 20 min
```

| Piece | Where | Why |
|---|---|---|
| React + Vite + Tailwind PWA | `src/` | Frontend, installable on iOS/Android |
| Postgres schema + RLS | `supabase/migrations/` | Users only see their own rows; tokens are unreadable from the browser |
| `strava-connect` / `-disconnect` / `-webhook` | `supabase/functions/` | OAuth exchange (holds the client secret), webhook handshake + events |
| Garmin service (FastAPI) | `garmin-service/` | `python-garminconnect` is Python, so it can't run in a Deno Edge Function |

## Setup

**Prereqs:** Node 20+, Python 3.12+, [Supabase CLI](https://supabase.com/docs/guides/cli), a Docker host for the Garmin service (Fly.io / Railway / Render), HTTPS for the frontend (required for PWAs).

### 1. Supabase project
Create a project, then from this folder:
```bash
supabase link --project-ref <ref>
supabase db push            # applies every file in supabase/migrations/ not yet on the remote
```
In *Auth → Providers* keep Email enabled (turn off "confirm email" while developing).

### 2. Strava app
Create one at https://www.strava.com/settings/api. Set **Authorization Callback Domain** to your PWA domain (`localhost` for dev). Note the Client ID and Secret.

### 3. Edge Functions
```bash
cp supabase/functions/.env.example supabase/functions/.env   # fill it in
supabase secrets set --env-file supabase/functions/.env
supabase functions deploy strava-connect strava-disconnect strava-webhook
```
`supabase/config.toml` already turns JWT verification off for `strava-webhook` only.

### 4. Garmin service
```bash
cd garmin-service
cp .env.example .env        # fill it in (key-generation commands are inside)
docker build -t garmin-service . && docker run --env-file .env -p 8000:8000 garmin-service   # local test
```
Deploy the same image to your host with the same env vars. **Run exactly one instance**: an in-progress MFA login lives in that process's memory.

### 5. Strava webhook subscription (once per app, covers all users)
```bash
curl -X POST https://www.strava.com/api/v3/push_subscriptions \
  -F client_id=YOUR_ID -F client_secret=YOUR_SECRET \
  -F callback_url=https://<ref>.supabase.co/functions/v1/strava-webhook \
  -F verify_token=YOUR_STRAVA_VERIFY_TOKEN
```
It returns `{"id": 123456}`. Put that id in `STRAVA_SUBSCRIPTION_ID` and re-run `supabase secrets set`.

### 6. Garmin polling
Edit the two placeholders in `supabase/cron.sql.example` and run it in the Supabase SQL editor.

### 7. Frontend
```bash
cp .env.example .env.local   # fill it in
npm install && npm run dev   # http://localhost:5173
npm run build                # deploy dist/ to Vercel / Netlify / Cloudflare Pages
```
After deploying, set `ALLOWED_ORIGIN` (Edge Function secret) and `ALLOWED_ORIGINS` (Garmin service) to your real origin.

### 8. Install on phone
iOS: Safari → Share → *Add to Home Screen*. Android: Chrome → *Install app*.

## Things to know before inviting users

**Strava**
- New apps start in single-player mode (**1 athlete**, you). You can self-upgrade to 10 in your API settings; more than 10 needs Strava's review, which has no guaranteed timeline. Submit early.
- Strava's API Agreement was updated June 1, 2026, and developers now need a Strava subscription. Read the agreement; third-party summaries say it restricts using API data in AI features and limits what you may display. This app only shows each athlete their own data.
- Strava announced a new API host for 2027. It's configurable (`STRAVA_API_BASE`, `STRAVA_OAUTH_BASE`), no code change needed.
- On deauthorization (webhook) or "Disconnect", the user's Strava data is deleted, as the terms require.

**Garmin**
- `python-garminconnect` is unofficial and Garmin can break it any time (the dependency is pinned to `<0.4`). It is also a gray area under Garmin's terms. Official Garmin APIs need a business developer approval.
- Many accounts logging in from one server IP can trigger Garmin rate limits or Cloudflare blocks. Syncs are sequential with a pause, and manual sync has a 60 s cooldown. Keep the cron interval at 15 min or more.
- The Garmin password is used once and never stored. Only the session token is kept, Fernet-encrypted with `TOKEN_ENCRYPTION_KEY`. **Lose that key and everyone must reconnect.**
- Disconnecting deletes our copy, but can't revoke the token at Garmin.

**Data**
- A workout that Garmin auto-uploads to Strava will appear twice (once per provider). Deduplication is intentionally not built yet.
- `activities.raw` keeps the full provider payload so new metrics can be added later without re-syncing.
