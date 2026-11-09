# Backend setup (Supabase) — ~15 minutes

The app works fully offline without any of this (share codes). Doing this switches on short links, server-verified
puzzles, hidden answers and the gate metrics.

1. Create a project at supabase.com (free tier is fine).
2. Dashboard → Authentication → Providers → enable **Allow anonymous sign-ins**.
3. SQL editor → paste `supabase/migrations/0001_ruleshift.sql` → Run.
4. Install the Supabase CLI, `supabase login`, `supabase link --project-ref <ref>`.
5. `npm run server:build` (bundles the shared engine into `supabase/functions/api/engine.bundle.js`) then
   `supabase functions deploy api`.
6. Copy `.env.example` to `.env` and fill `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` (anon key only).
7. Rebuild the app. Done: publishing now goes through the server; if it's unreachable the app falls back to codes.

**Important:** re-run steps 5 whenever you change anything under `src/game`, `src/rules`, `src/social` or `src/server`
(the server must run the exact same engine version as the app: `ENGINE_VERSION`).

## Reading your Phase-2 gate numbers
```sql
select * from gate_daily;        -- opens, solves, shares, shares_per_solve per day  (goal: shares_per_solve >= 0.20)
select * from chain_virality order by children desc limit 20;   -- which puzzles spread, and how far
select max(depth), avg(depth) from nodes;                        -- how deep chains get
```

## Universal links (so a friend's tap opens the app)
1. Buy/choose a domain, host the `site/` folder (Netlify, Vercel or Cloudflare Pages; configs included).
2. Edit `site/.well-known/apple-app-site-association`: replace `TEAMID.com.example.ruleshift` with your Apple Team ID + bundle id.
3. Set `SHARE_HOST` in `src/social/links.ts`, and `associatedDomains` in `app.json` (`applinks:yourdomain.com`).
4. Put the App Store URL in `site/c/index.html` once it exists.

## Migration 0003 (Part 6)
Run `supabase/migrations/0003_custom_levels.sql` (adds `nodes.custom jsonb`, root nodes only), then redeploy the `api` function (engine bundle was rebuilt).
