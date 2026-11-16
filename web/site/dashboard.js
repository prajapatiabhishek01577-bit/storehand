import { requireUser, signOut, api, server, $, $$, esc, ago } from "./lib.js";

await requireUser();
let bots = [];
let chatBot = null;

const ACCOUNTS = [
  ["Instagram", "Social"], ["Facebook", "Social"], ["TikTok", "Social"],
  ["Google Business Profile", "SEO"], ["Email inbox", "Inbox"], ["WhatsApp Business", "Inbox"],
];

function err(e) {
  $("#err").textContent = e ? e.message || String(e) : "";
  $("#err").classList.toggle("hide", !e);
}

// Tabs, by URL hash so links like dashboard.html#approvals work.
function tab(name) {
  name = $(`[data-panel="${name}"]`) ? name : "bots";
  $$(".tabs button").forEach((b) => b.classList.toggle("on", b.dataset.tab === name));
  $$("[data-panel]").forEach((p) => p.classList.toggle("hide", p.dataset.panel !== name));
  history.replaceState(null, "", "#" + name);
  ({ bots: loadBots, chat: loadChat, approvals: loadApprovals, activity: loadActivity, accounts: loadAccounts, models: loadModels, settings: loadSettings })[name]?.();
}
$$(".tabs button").forEach((b) => (b.onclick = () => tab(b.dataset.tab)));
$("#logout").onclick = signOut;

async function refreshBots() {
  bots = (await api("GET", "/api/state")).bots.filter((b) => !b.hidden);
  return bots;
}

async function loadBots() {
  if (!server.ready) return tab("settings");
  try {
    await refreshBots();
    err();
    $("#no-bots").textContent = bots.length < 4 ? "Finish setup to get your Social, Inbox, and SEO helpers." : "";
    const routines = await Promise.all(bots.map((b) => api("GET", `/api/bots/${b.id}/routines`).catch(() => [])));
    $("#bots").innerHTML = bots.map((b, i) => `<div class="card">
      <div class="item" style="padding:0"><h3 style="margin:0"><span style="color:${esc(b.color)}">●</span> ${esc(b.name)}</h3>
      <span class="pill ${b.working ? "warn" : ""}">${b.working ? esc(b.status || "Working") : "Idle"}</span></div>
      <p class="muted small">${esc(b.preview || "No messages yet.")}</p>
      ${routines[i].length ? `<p class="small"><b>Routines:</b> ${routines[i].map((r) => esc(r.name)).join(", ")}</p>` : ""}
      <button class="btn small" data-chat="${b.id}">Chat</button></div>`).join("");
    $$("[data-chat]").forEach((x) => (x.onclick = () => { chatBot = x.dataset.chat; tab("chat"); }));
  } catch (e) { err(e); }
}

async function loadChat() {
  if (!server.ready) return tab("settings");
  try {
    if (!bots.length) await refreshBots();
    chatBot ||= bots[0]?.id;
    $("#chat-bot").innerHTML = bots.map((b) => `<option value="${b.id}" ${b.id === chatBot ? "selected" : ""}>${esc(b.name)}</option>`).join("");
    await renderMessages();
  } catch (e) { err(e); }
}
$("#chat-bot").onchange = (e) => { chatBot = e.target.value; renderMessages(); };

async function renderMessages() {
  if (!chatBot) return;
  const msgs = await api("GET", `/api/bots/${chatBot}/messages`);
  api("POST", `/api/bots/${chatBot}/read`).catch(() => {});
  $("#messages").innerHTML = msgs.map((m) => {
    const me = m.role === "user";
    const q = m.question;
    const card = q ? `<div><b>${esc(q.title)}</b>${q.approval ? ' <span class="pill warn">approval</span>' : ""}<div class="row" style="flex-wrap:wrap;margin-top:6px">${
      q.options.map((o, i) => `<button class="btn small ${q.picked === i ? "" : "ghost"}" ${q.picked != null ? "disabled" : ""} data-answer="${m.id}" data-opt="${i}">${esc(o)}</button>`).join("")}</div></div>` : "";
    return `<div class="bubble ${me ? "me" : ""} ${m.error ? "err" : ""}">${esc(m.text)}${card}</div>`;
  }).join("") || `<p class="muted small">Say hi to your helper.</p>`;
  bindAnswers($("#messages"), () => renderMessages());
  $("#messages").scrollTop = 1e9;
}

function bindAnswers(root, after) {
  $$("[data-answer]", root).forEach((btn) => (btn.onclick = async () => {
    const id = Number(btn.dataset.answer), opt = Number(btn.dataset.opt);
    const botId = btn.dataset.bot || chatBot;
    btn.disabled = true;
    try {
      await api("POST", `/api/bots/${botId}/messages`, { text: btn.textContent.trim(), answer: { messageId: id, option: opt } });
      after();
    } catch (e) { err(e); btn.disabled = false; }
  }));
}

$("#send").onsubmit = async (e) => {
  e.preventDefault();
  const text = $("#text").value.trim();
  if (!text || !chatBot) return;
  $("#text").value = "";
  try { await api("POST", `/api/bots/${chatBot}/messages`, { text }); await renderMessages(); } catch (e2) { err(e2); }
};

async function loadApprovals() {
  if (!server.ready) return tab("settings");
  try {
    const list = await api("GET", "/api/approvals");
    const pending = list.filter((a) => a.pending).length;
    $("#pending-count").textContent = pending;
    $("#pending-count").classList.toggle("hide", !pending);
    $("#approvals").innerHTML = list.map((a) => `<div class="item"><div><b>${esc(a.title)}</b>
      <div class="muted small">${esc(a.botName)} · ${ago(a.at)} ago${a.pending ? "" : " · " + esc(a.options[a.picked])}</div></div>
      ${a.pending ? `<div class="row" style="flex:0 0 auto">${a.options.map((o, i) => `<button class="btn small ${i ? "danger" : ""}" data-answer="${a.messageId}" data-opt="${i}" data-bot="${a.botId}">${esc(o)}</button>`).join("")}</div>` : ""}
      </div>`).join("") || `<p class="muted">Nothing waiting. Helpers ask here before spending money, ordering, or messaging a new supplier.</p>`;
    bindAnswers($("#approvals"), loadApprovals);
  } catch (e) { err(e); }
}

async function loadActivity() {
  if (!server.ready) return tab("settings");
  try {
    if (!bots.length) await refreshBots();
    const all = (await Promise.all(bots.map((b) => api("GET", `/api/bots/${b.id}/messages`).then((ms) => ms.map((m) => ({ ...m, bot: b.name })))))).flat();
    all.sort((a, b) => b.at - a.at);
    $("#activity").innerHTML = all.slice(0, 50).map((m) => `<div class="item"><div><b>${esc(m.bot)}</b> <span class="muted small">${m.role === "routine" ? "routine" : m.role === "user" ? "you" : ""}</span>
      <div class="small">${esc((m.text || m.question?.title || "").slice(0, 160))}</div></div><span class="muted small">${ago(m.at)}</span></div>`).join("") || `<p class="muted">No activity yet.</p>`;
  } catch (e) { err(e); }
}

function loadAccounts() {
  // Account linking (Postiz for social, WhatsApp webhook) is not built yet; shown so owners know what's coming.
  $("#accounts").innerHTML = ACCOUNTS.map(([name, who]) => `<div class="item"><div><b>${esc(name)}</b><div class="muted small">Used by ${esc(who)}</div></div>
    <button class="btn small ghost" disabled title="Coming soon">Connect · soon</button></div>`).join("");
}

async function loadModels() {
  if (!server.ready) return tab("settings");
  try {
    const st = await api("GET", "/api/state");
    bots = st.bots.filter((b) => !b.hidden);
    const models = {};
    for (const h of st.harnesses) models[h] = await api("GET", `/api/harnesses/${h}/models`).catch(() => []);
    const opts = (b) => {
      const list = models[b.harness] || [];
      const ids = list.map((m) => m.id || m.name || m).filter(Boolean);
      return `<option value="">Default</option>` + ids.map((id) => `<option ${id === b.model ? "selected" : ""}>${esc(id)}</option>`).join("");
    };
    $("#models").innerHTML = bots.map((b) => `<div class="item"><div><b>${esc(b.name)}</b><div class="muted small">${esc(b.harness)}</div></div>
      <select data-model="${b.id}" style="max-width:55%">${opts(b)}</select></div>`).join("") +
      (st.harnesses.length ? "" : `<p class="notice small">No AI harness is installed on your server yet.</p>`);
    $$("[data-model]").forEach((s) => (s.onchange = async () => {
      try { await api("PATCH", `/api/bots/${s.dataset.model}`, { model: s.value || null }); } catch (e) { err(e); }
    }));
  } catch (e) { err(e); }
}

function loadSettings() {
  $("#server-url").value = server.url;
  $("#send-profile").classList.toggle("hide", !(localStorage.getItem("sh_profile_pending") && server.ready));
}
$("#server-form").onsubmit = async (e) => {
  e.preventDefault();
  server.save($("#server-url").value, $("#server-pass").value);
  try {
    await api("GET", "/api/state");
    $("#server-msg").textContent = "Connected.";
    $("#server-msg").className = "ok small";
    err();
    loadSettings();
  } catch (e2) {
    $("#server-msg").textContent = "Couldn't connect: " + e2.message;
    $("#server-msg").className = "notice small";
  }
};
$("#send-profile").onclick = async () => {
  const { _rows, ...profile } = JSON.parse(localStorage.getItem("sh_profile_draft") || "{}");
  try {
    await api("POST", "/api/onboarding", profile);
    localStorage.removeItem("sh_profile_pending");
    tab("bots");
  } catch (e) { err(e); }
};

tab(location.hash.slice(1) || "bots");
setInterval(() => {
  const on = $(".tabs button.on")?.dataset.tab;
  if (document.hidden || !server.ready) return;
  if (on === "chat") renderMessages().catch(() => {});
  if (on === "approvals") loadApprovals();
}, 5000);
