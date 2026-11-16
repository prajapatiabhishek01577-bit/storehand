// Cloudflare Pages build: `node build.mjs` -> dist/. Reads SUPABASE_URL and SUPABASE_ANON_KEY
// from the Pages env (the anon key is public by design). No dependencies.
import { cpSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
const out = new URL("./dist/", import.meta.url);
mkdirSync(out, { recursive: true });
for (const f of readdirSync(new URL("./", import.meta.url))) {
  if ((/\.(html|css|js)$/.test(f) || f === "_headers") && !["build.mjs", "config.example.js"].includes(f)) cpSync(new URL(f, import.meta.url), new URL(f, out));
}
const cfg = { SUPABASE_URL: process.env.SUPABASE_URL || "", SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || "" };
writeFileSync(new URL("config.js", out), `window.STOREHAND = ${JSON.stringify(cfg)};\n`);
console.log("built dist/", cfg.SUPABASE_URL ? "(supabase configured)" : "(no SUPABASE_URL: auth runs in demo mode)");
