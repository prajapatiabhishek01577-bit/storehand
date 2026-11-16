// Shared: Supabase auth, the customer's Feral AI server, small DOM helpers.
// Auth runs in demo mode (local only) until SUPABASE_URL / SUPABASE_ANON_KEY are set at build.
const CFG = window.FERALAI || {};
export const configured = !!(CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY && !CFG.SUPABASE_URL.includes("<"));
let sb = null;
async function client() {
  if (!configured) return null;
  if (!sb) {
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    sb = createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY);
  }
  return sb;
}

export async function signUp(email, password) {
  const c = await client();
  if (!c) { localStorage.setItem("sh_demo_user", email); return { demo: true }; }
  const { data, error } = await c.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}
export async function signIn(email, password) {
  const c = await client();
  if (!c) { localStorage.setItem("sh_demo_user", email); return { demo: true }; }
  const { data, error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}
export async function signOut() {
  const c = await client();
  if (c) await c.auth.signOut();
  localStorage.removeItem("sh_demo_user");
  location.href = "login.html";
}
export async function currentUser() {
  const c = await client();
  if (!c) { const e = localStorage.getItem("sh_demo_user"); return e ? { email: e, demo: true } : null; }
  const { data } = await c.auth.getUser();
  return data.user;
}
export async function requireUser() {
  const u = await currentUser();
  if (!u) location.href = "login.html";
  return u;
}

// The customer's own Feral AI server (one container per shop).
// Until provisioning links it to the account, the owner pastes its URL and password once.
export const server = {
  get url() { return (localStorage.getItem("sh_server") || "").replace(/\/+$/, ""); },
  get pass() { return localStorage.getItem("sh_pass") || ""; },
  save(url, pass) { localStorage.setItem("sh_server", url.trim()); localStorage.setItem("sh_pass", pass); },
  get ready() { return !!this.url; },
};
export async function api(method, path, body) {
  if (!server.ready) throw new Error("Connect your Feral AI server first (Settings).");
  const headers = { "content-type": "application/json" };
  if (server.pass) headers.authorization = "Basic " + btoa("owner:" + server.pass);
  const res = await fetch(server.url + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  if (!res.ok) throw new Error((data && data.error) || `HTTP ${res.status}`);
  return data;
}

export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
export const ago = (ms) => { const m = Math.round((Date.now() - ms) / 60000); return m < 1 ? "now" : m < 60 ? `${m}m` : m < 1440 ? `${Math.round(m / 60)}h` : `${Math.round(m / 1440)}d`; };
