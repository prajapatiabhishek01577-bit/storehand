import { requireUser, api, server, $, $$, esc } from "./lib.js";

await requireUser();
const KEY = "sh_profile_draft";
const steps = $$(".step");
let at = 0;
const ROWS = {
  suppliers: [["supplier", "Supplier"], ["item", "Item"], ["price", "Price now"]],
  limits: [["item", "Item"], ["targetPrice", "Aim for"], ["maxPrice", "Max"]],
  socials: [["platform", "instagram, facebook, tiktok, google"], ["handle", "@handle or link"]],
};

function addRow(kind, v = {}) {
  const d = document.createElement("div");
  d.className = "row";
  d.style.margin = "8px 0";
  d.innerHTML =
    ROWS[kind].map(([k, ph]) => `<input data-k="${k}" placeholder="${esc(ph)}" value="${esc(v[k] || "")}" aria-label="${esc(ph)}">`).join("") +
    `<button type="button" class="btn small ghost" aria-label="Remove">×</button>`;
  d.querySelector("button").onclick = () => { d.remove(); save(); };
  $("#" + kind).append(d);
}
const rows = (kind) => $$(`#${kind} .row`).map((r) => Object.fromEntries($$("input", r).map((i) => [i.dataset.k, i.value.trim()])));

export function collect() {
  const sup = {};
  for (const r of rows("suppliers")) {
    if (!r.supplier) continue;
    sup[r.supplier] ||= [];
    if (r.item) sup[r.supplier].push({ item: r.item, price: r.price });
  }
  return {
    businessName: $("#businessName").value.trim(),
    location: $("#location").value.trim(),
    sells: $("#sells").value.trim(),
    bestSellers: $("#bestSellers").value.split(",").map((s) => s.trim()).filter(Boolean),
    seasonality: $("input[name=seasonality]:checked").value,
    seasonNotes: $("#seasonNotes").value.trim(),
    suppliers: Object.entries(sup).map(([name, items]) => ({ name, items })),
    priceLimits: rows("limits").filter((r) => r.item),
    socials: rows("socials").filter((r) => r.platform && r.handle),
    _rows: { suppliers: rows("suppliers"), limits: rows("limits"), socials: rows("socials") },
  };
}
function save() { localStorage.setItem(KEY, JSON.stringify(collect())); }
function load() {
  const p = JSON.parse(localStorage.getItem(KEY) || "{}");
  for (const k of ["businessName", "location", "sells", "seasonNotes"]) if (p[k]) $("#" + k).value = p[k];
  if (p.bestSellers) $("#bestSellers").value = p.bestSellers.join(", ");
  if (p.seasonality) $(`input[name=seasonality][value=${p.seasonality}]`).checked = true;
  for (const kind of Object.keys(ROWS)) {
    const list = p._rows?.[kind] || [];
    (list.length ? list : [{}]).forEach((v) => addRow(kind, v));
  }
}

function show() {
  steps.forEach((s, i) => s.classList.toggle("hide", i !== at));
  $("#steps").innerHTML = steps.map((_, i) => `<i class="${i <= at ? "on" : ""}"></i>`).join("");
  $("#back").style.visibility = at ? "visible" : "hidden";
  $("#next").textContent = at === steps.length - 1 ? "Set up my helpers" : "Next";
  if (at === steps.length - 1) review();
}
function review() {
  const p = collect();
  $("#review").innerHTML = `<p><b>${esc(p.businessName)}</b>${p.location ? " · " + esc(p.location) : ""}</p>
    <p>${esc(p.sells)}</p>
    <p class="muted">Best sellers: ${esc(p.bestSellers.join(", ") || "none")} · ${esc(p.seasonality)}</p>
    <p class="muted">${p.suppliers.length} supplier(s) · ${p.priceLimits.length} price limit(s) · ${p.socials.length} social account(s)</p>
    <p>We'll create three helpers: <b>Social</b>, <b>Inbox</b>, and <b>SEO</b>. They ask you before spending money, ordering, or contacting a new supplier.</p>
    ${server.ready ? "" : `<p class="notice">Your server isn't connected yet. We'll save this and send it once you connect it in Dashboard → Settings.</p>`}`;
}
function valid() {
  for (const el of steps[at].querySelectorAll("[required]")) {
    if (!el.value.trim()) { el.focus(); el.style.borderColor = "#b42318"; return false; }
  }
  return true;
}

$$("[data-add]").forEach((b) => (b.onclick = () => addRow(b.dataset.add)));
$("#wiz").addEventListener("input", save);
$("#back").onclick = () => { at = Math.max(0, at - 1); show(); };
$("#wiz").onsubmit = async (e) => {
  e.preventDefault();
  if (!valid()) return;
  save();
  if (at < steps.length - 1) { at++; return show(); }
  const { _rows, ...profile } = collect();
  $("#err").classList.add("hide");
  if (!server.ready) {
    localStorage.setItem("sh_profile_pending", "1");
    location.href = "dashboard.html#settings";
    return;
  }
  $("#next").disabled = true;
  try {
    await api("POST", "/api/onboarding", profile);
    localStorage.removeItem("sh_profile_pending");
    $("#ok").textContent = "Your helpers are ready.";
    $("#ok").classList.remove("hide");
    setTimeout(() => (location.href = "dashboard.html"), 800);
  } catch (err) {
    $("#err").textContent = err.message;
    $("#err").classList.remove("hide");
    $("#next").disabled = false;
  }
};
load();
show();
