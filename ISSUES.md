# Known issues (run 1, not blockers)

1. **Dashboard auth to the shop server is a pasted password (Basic auth).** Supabase login guards the site only; botd does not verify Supabase JWTs. The provisioner should store each shop's server URL in Supabase and botd should accept a Supabase JWT (or a per-shop token).
2. **Password kept in localStorage** on the dashboard. Replace with item 1.
3. **Approvals are prompt + tool enforced, not sandbox enforced.** Bots are told to run `botctl approve` and the bot token can't answer cards, but a bot with a browser could still click "Buy". Real money actions need a payment/ordering tool that requires an approval id.
4. **Approval waits 9 minutes**, then tells the bot to stop; the owner's later answer arrives as a normal message and the bot must redo the step.
5. **Dashboard polls every 5s** (no SSE: EventSource can't send the auth header cross-origin).
6. **Connect accounts is UI only** ("soon" buttons). Postiz / WhatsApp linking is a later step.
7. **Model settings use the existing per-bot PATCH**; no per-customer model policy or cost cap yet (model settings backend is a later step).
8. **Docker image is large** (Chromium + Node + harness CLI). agent-desktop is not installed (no arm64 build); Bots get the browser only.
9. **Chromium runs with `--no-sandbox`** inside the container (container is the boundary: non-root, cap_drop ALL, no-new-privileges).
10. **Harness login inside the container** (Claude Code auth) is not automated; set `ANTHROPIC_API_KEY` in the customer env file.
11. **Re-running onboarding rewrites each helper's Job/Rules** (Work log is kept). Owner edits to those sections are lost.
12. **4-customer cap** is enforced only by the compose file having 4 slots; signup does not check it.
13. `docs/` and `grok-bot-internals/` still describe upstream SuperBot internals.

## Run 2 (Feral AI rebrand, not blockers)

14. **GitHub repo is still named `storehand`.** Rename the repo (and local folder) when convenient; links in docs still point to it.
15. **Logo crops sit on the logo's cream background** (#F5F0EA-ish), a touch warmer than the site's #F5F4F1. No transparent version exists; the header mark is clipped to a circle. Ask the designer for an SVG/transparent export.
16. **Dark mode header uses the app-icon crop** (dark rounded square) since the light-mode mark is black on cream.
17. **In-container chat app (`web/index.html`, `web/styles.css`)** got the name change only, not the new palette/font.
18. **Docker user renamed** `storehand` -> `feralai` (same uid 10001). Existing volumes are fine (owned by uid), but any host scripts using `/home/storehand` must change.
19. **Inter loads from Google Fonts**; self-host later if privacy/CSP requires it.
