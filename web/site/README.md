# Feral AI site (Cloudflare Pages)

Static, no framework. Pages settings:
- Root directory: `web/site`
- Build command: `node build.mjs`
- Output directory: `dist`
- Env vars: `SUPABASE_URL`, `SUPABASE_ANON_KEY` (public anon key). Without them, login runs in local demo mode.

Pages: `index.html` landing, `login.html` signup/login, `onboarding.html` wizard, `dashboard.html` (helpers, chat, approvals, activity, accounts, models, settings).
The dashboard talks to the shop's own Feral AI server (set its URL + password in Settings). That server must list this site's origin in `ALLOWED_ORIGIN`.
