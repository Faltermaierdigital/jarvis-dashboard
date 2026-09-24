import { OWNER, AGENTS } from "./config.js?v=4";
import * as gh from "./github.js?v=4";

// Alle Inhalte werden per textContent / createElement gebaut, nie per
// innerHTML: Absender und Betreffs stammen aus Spam-Mails und sind damit
// fremder, potenziell boesartiger Text.

const DEMO = new URLSearchParams(location.search).has("demo");
const TZ = "Europe/Berlin";
const RESULT_DAYS = 14;

const state = {
  connected: false,
  loading: false,
  error: null,
  lastUpdate: null,
  runs: {},          // agentId -> [run]
  agentErrors: {},   // agentId -> message
  results: {},       // runId -> result.json
  resultErrors: [],
  pending: {},       // agentId -> timestamp des manuellen Starts
  closing: {},       // Todoist-ID -> timestamp, Haken gesetzt, Abgleich laeuft
  ui: { run: null, account: "", kind: "" },
};
let timer = null;

// ---------- DOM-Helfer ----------
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (k === "style") Object.assign(el.style, v);
    else if (k === "value") el.value = v;
    else el.setAttribute(k, v === true ? "" : v);
  }
  append(el, kids);
  return el;
}
const SVGNS = "http://www.w3.org/2000/svg";
function s(tag, attrs, ...kids) {
  const el = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs || {})) if (v != null) el.setAttribute(k, v);
  append(el, kids);
  return el;
}
function append(el, kids) {
  for (const c of kids.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

const ICONS = {
  home: ["M3 10.5 12 3l9 7.5", "M5 9.5V21h14V9.5", "M10 21v-6h4v6"],
  agents: ["M7 5h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z", "M9.5 9.5h5v5h-5z", "M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3"],
  filter: ["M3 4h18l-7 8.5V19l-4 2v-8.5z"],
  activity: ["M3 12h4l3-8 4 16 3-8h4"],
  settings: ["M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1", "M15 4v4M9 10v4M17 16v4"],
  mail: ["M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z", "m3 7 9 6 9-6"],
  calendar: ["M7 3v4M17 3v4", "M5 6h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1z", "M4 11h16", "M8 15h2M14 15h2"],
  play: ["M7 4.5v15l12.5-7.5z"],
  arrow: ["M5 12h14", "m13 6 6 6-6 6"],
  trend: ["M3 17 9 11l4 4 8-8", "M15 7h6v6"],
  check: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z", "m8 12 3 3 5-6"],
  zap: ["M13 2 4 14h7l-1 8 9-12h-7z"],
  pulse: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z", "M7 12h2l1.5-3 3 6 1.5-3h2"],
  inbox: ["M22 12h-6l-2 3h-4l-2-3H2", "M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.7 1.1z"],
  logout: ["M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4", "m16 17 5-5-5-5", "M21 12H9"],
  refresh: ["M21 12a9 9 0 1 1-2.6-6.4", "M21 3v6h-6"],
  external: ["M14 3h7v7", "M10 14 21 3", "M19 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5"],
  mic: ["M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z", "M5 11a7 7 0 0 0 14 0", "M12 18v3M9 21h6"],
  send: ["M22 2 11 13", "M22 2 15 22l-4-9-9-4z"],
};
function icon(name, cls) {
  return s("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "1.7", "stroke-linecap": "round", "stroke-linejoin": "round", class: cls, "aria-hidden": "true" },
    (ICONS[name] || []).map((d) => s("path", { d })));
}
function logo(cls) {
  return s("svg", { viewBox: "0 0 64 64", class: cls, "aria-hidden": "true" },
    s("defs", {}, s("linearGradient", { id: "lg", x1: "0", y1: "0", x2: "1", y2: "1" },
      s("stop", { offset: "0", "stop-color": "#38c8f0" }), s("stop", { offset: "1", "stop-color": "#8b7cf6" }))),
    s("path", { d: "M32 5 55 18.5v27L32 59 9 45.5v-27z", fill: "none", stroke: "url(#lg)", "stroke-width": "3", "stroke-linejoin": "round" }),
    s("path", { d: "M32 17 44 24v14l-12 7-12-7V24z", fill: "none", stroke: "#38c8f0", "stroke-width": "2.4", "stroke-linejoin": "round" }),
    s("path", { d: "M20 24l12 7 12-7M32 31v14", fill: "none", stroke: "#8b7cf6", "stroke-width": "2.2", "stroke-linejoin": "round" }));
}

// ---------- Zeit ----------
const fmt = (opts) => new Intl.DateTimeFormat("de-DE", { timeZone: TZ, ...opts });
const fTime = fmt({ hour: "2-digit", minute: "2-digit", second: "2-digit" });
const fShort = fmt({ day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const fDay = fmt({ day: "2-digit", month: "2-digit" });
const fDayLong = fmt({ weekday: "short", day: "2-digit", month: "2-digit" });
// ISO-Tag (YYYY-MM-DD) in Berliner Zeit, vergleichbar mit Todoist-/Kalenderdaten.
const fDayKey = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const dayKey = (d) => fDayKey.format(d);
function when(iso) {
  const d = new Date(iso);
  return dayKey(d) === dayKey(new Date()) ? fTime.format(d) : fShort.format(d).replace(",", "");
}
function duration(run) {
  const a = new Date(run.run_started_at || run.created_at), b = new Date(run.updated_at);
  const sec = Math.max(0, Math.round((b - a) / 1000));
  return sec >= 60 ? `${Math.floor(sec / 60)}m ${String(sec % 60).padStart(2, "0")}s` : `${sec}s`;
}
function ago(date) {
  const m = Math.round((Date.now() - date) / 60000);
  if (m < 1) return "gerade eben";
  if (m < 60) return `vor ${m} Min.`;
  const hrs = Math.round(m / 60);
  return hrs < 24 ? `vor ${hrs} Std.` : `vor ${Math.round(hrs / 24)} Tg.`;
}

// ---------- Daten ----------
const activeAgents = () => AGENTS.filter((a) => a.status !== "planned");

async function load() {
  if (state.loading) return;
  state.loading = true;
  try {
    if (DEMO) {
      const { buildDemo } = await import("./demo.js?v=4");
      const d = buildDemo(AGENTS);
      state.runs = d.runs;
      state.results = d.results;
    } else {
      state.resultErrors = [];
      await Promise.all(activeAgents().map(async (cfg) => {
        try {
          state.runs[cfg.id] = await gh.listRuns(OWNER, cfg.repo, cfg.workflow);
          delete state.agentErrors[cfg.id];
          if (cfg.artifact) await loadResults(cfg);
        } catch (e) {
          if (e.status === 401) throw e;
          state.agentErrors[cfg.id] = e.status === 404
            ? `Der Token hat keinen Zugriff auf das Repo ${cfg.repo}. Token bei GitHub um dieses Repo erweitern.`
            : e.message;
        }
      }));
    }
    state.error = null;
    state.lastUpdate = new Date();
  } catch (e) {
    if (e.status === 401) { logout("Der Token ist abgelaufen oder ungültig. Bitte neu verbinden."); return; }
    state.error = e.message;
  } finally {
    state.loading = false;
  }
  for (const [id, t] of Object.entries(state.pending)) {
    const newer = (state.runs[id] || []).some((r) => new Date(r.created_at) >= t - 15000);
    if (newer || Date.now() - t > 120000) delete state.pending[id];
  }
  const snap = latestSnapshot();
  for (const [id, t] of Object.entries(state.closing)) {
    const fresh = snap && new Date(snap.finished_at) > t;
    if ((fresh && !snap.tasks.some((x) => x.id === id)) || Date.now() - t > 180000) delete state.closing[id];
  }
  render();
  schedule();
}

async function loadResults(cfg) {
  const arts = await gh.listArtifacts(OWNER, cfg.repo, cfg.artifact);
  const todo = arts
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, cfg.results || RESULT_DAYS)
    .filter((a) => a.workflow_run && !state.results[a.workflow_run.id]);
  await Promise.all(todo.map(async (a) => {
    try {
      const data = await gh.readArtifactJson(OWNER, cfg.repo, a.id, cfg.artifactFile || "result.json");
      state.results[a.workflow_run.id] = { ...data, agent: cfg.id };
    } catch (e) {
      state.resultErrors.push(`${cfg.name}: Ergebnis vom ${fShort.format(new Date(a.created_at))} nicht lesbar (${e.message})`);
    }
  }));
}

function schedule() {
  clearTimeout(timer);
  if (!state.connected) return;
  const busy = Object.keys(state.pending).length > 0 || Object.keys(state.closing).length > 0 ||
    Object.values(state.runs).some((runs) => runs[0] && runs[0].status !== "completed");
  timer = setTimeout(load, busy ? 8000 : 60000);
}

function resultsFor(agentId) {
  const runIds = new Set((state.runs[agentId] || []).map((r) => r.id));
  return Object.entries(state.results)
    .filter(([id, r]) => r.agent === agentId && runIds.has(Number(id)))
    .map(([id, r]) => ({ runId: Number(id), ...r }))
    .sort((a, b) => new Date(b.finished_at) - new Date(a.finished_at));
}

// Letzter planmaessiger Lauf, dessen Toleranzfenster schon abgelaufen ist.
function lastExpected(cfg, now) {
  const graceMs = (cfg.graceHours || 3) * 3600e3;
  const hours = [...cfg.schedule.utcHours].sort((a, b) => b - a);
  for (let back = 0; back < 3; back++) {
    for (const hr of hours) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - back, hr, cfg.schedule.utcMinute));
      if (now - d >= graceMs) return d;
    }
  }
  return new Date(0);
}

function agentStatus(cfg) {
  if (cfg.status === "planned") return { key: "planned", label: "Geplant" };
  if (state.pending[cfg.id]) return { key: "running", label: "Startet" };
  if (state.agentErrors[cfg.id]) return { key: "fail", label: "Keine Daten" };
  const runs = state.runs[cfg.id] || [];
  const last = runs[0];
  if (last && last.status !== "completed") return { key: "running", label: last.status === "queued" ? "Wartet" : "Läuft" };
  if (!last) return { key: "late", label: "Noch nie gelaufen" };
  if (cfg.schedule) {
    const exp = lastExpected(cfg, new Date());
    if (!runs.some((r) => new Date(r.created_at) >= new Date(exp - 10 * 60e3))) return { key: "late", label: "Überfällig" };
  }
  if (last.conclusion === "success") {
    const res = state.results[last.id];
    if (res && res.totals) {
      const t = res.totals, parts = [];
      const skipped = t.accounts_total - t.accounts_ok;
      if (skipped) parts.push(`${skipped} Postfach${skipped > 1 ? "er" : ""} übersprungen`);
      if (t.failed) parts.push(`${t.failed} Mail${t.failed > 1 ? "s" : ""} nicht verschoben`);
      if (parts.length) return { key: "late", label: "Mit Warnung", detail: parts.join(", ") };
    }
    return { key: "ok", label: "Erfolgreich" };
  }
  if (last.conclusion === "cancelled") return { key: "late", label: "Abgebrochen" };
  const failRes = state.results[last.id];
  return { key: "fail", label: "Fehlgeschlagen", detail: failRes && failRes.error ? failRes.error : "" };
}

function successRate(cfg, days = 30) {
  const since = Date.now() - days * 864e5;
  const done = (state.runs[cfg.id] || []).filter((r) => r.status === "completed" && new Date(r.created_at) >= since);
  if (!done.length) return null;
  return { ok: done.filter((r) => r.conclusion === "success").length, total: done.length };
}

// ---------- Aktionen ----------
async function startAgent(cfg) {
  let inputs;
  if (cfg.input) {
    const text = await inputDialog(cfg.input);
    if (!text) return;
    inputs = { text, source: "dashboard" };
  } else if (cfg.confirm !== false) {
    const ok = await confirmDialog(`${cfg.name} jetzt starten?`, cfg.confirm || "Der Agent wird sofort ausgeführt.", "Jetzt starten");
    if (!ok) return;
  }
  if (DEMO) { toast("Demo-Modus: Es wurde nichts gestartet."); return; }
  try {
    await gh.dispatch(OWNER, cfg.repo, cfg.workflow, cfg.ref || "main", inputs);
    state.pending[cfg.id] = Date.now();
    toast(`${cfg.name} gestartet. Der Status aktualisiert sich automatisch.`);
    render();
    clearTimeout(timer);
    timer = setTimeout(load, 4000);
  } catch (e) {
    toast(`Start fehlgeschlagen: ${e.message}`, true);
  }
}

// Haken im Planer: startet den Abgleich mit der Aufgaben-ID, der sie in
// Todoist erledigt und danach Kalender und To-dos neu holt.
async function closeTask(task) {
  const cfg = AGENTS.find((a) => a.id === "sync");
  if (!cfg || state.closing[task.id]) return;
  state.closing[task.id] = Date.now();
  render();
  if (DEMO) { toast(`Demo-Modus: „${task.content}“ wurde nicht wirklich erledigt.`); return; }
  try {
    await gh.dispatch(OWNER, cfg.repo, cfg.workflow, cfg.ref || "main", { close_task_id: task.id });
    toast(`„${task.content}“ wird in Todoist erledigt …`);
    clearTimeout(timer);
    timer = setTimeout(load, 8000);
  } catch (e) {
    delete state.closing[task.id];
    render();
    toast(`Abhaken fehlgeschlagen: ${e.message}`, true);
  }
}

const TOKEN_KEY = "jarvis-dashboard-token";
function storedToken() { try { return sessionStorage.getItem(TOKEN_KEY); } catch { return null; } }
function storeToken(t) { try { if (t) sessionStorage.setItem(TOKEN_KEY, t); else sessionStorage.removeItem(TOKEN_KEY); } catch {} }

function logout(message) {
  storeToken(null);
  gh.setToken(null);
  clearTimeout(timer);
  Object.assign(state, { connected: false, runs: {}, results: {}, agentErrors: {}, resultErrors: [], pending: {}, error: null });
  renderLogin(message);
}

function confirmDialog(title, text, okLabel) {
  return new Promise((resolve) => {
    const close = (v) => { overlay.remove(); resolve(v); };
    const okBtn = h("button", { class: "btn primary", onclick: () => close(true) }, icon("play"), okLabel);
    const overlay = h("div", { class: "overlay", onclick: (e) => { if (e.target === overlay) close(false); } },
      h("div", { class: "panel modal", role: "dialog", "aria-modal": "true" },
        h("h3", {}, title), h("p", {}, text),
        h("div", { class: "actions" }, h("button", { class: "btn ghost", onclick: () => close(false) }, "Abbrechen"), okBtn)));
    overlay.addEventListener("keydown", (e) => { if (e.key === "Escape") close(false); });
    document.body.append(overlay);
    okBtn.focus();
  });
}

function inputDialog(spec) {
  return new Promise((resolve) => {
    const close = (v) => { overlay.remove(); resolve(v); };
    const area = h("textarea", { rows: "3", maxlength: "1000", placeholder: spec.placeholder || "", "aria-label": spec.title });
    const okBtn = h("button", { class: "btn primary", type: "submit" }, icon("send"), spec.button || "Senden");
    const form = h("form", {
      class: "panel modal", role: "dialog", "aria-modal": "true",
      onsubmit: (e) => { e.preventDefault(); const t = area.value.trim(); if (t) close(t); },
    },
      h("h3", {}, spec.title), h("p", {}, spec.text || ""), area,
      h("div", { class: "actions" }, h("button", { class: "btn ghost", type: "button", onclick: () => close(null) }, "Abbrechen"), okBtn));
    area.addEventListener("keydown", (e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) form.requestSubmit(); });
    const overlay = h("div", { class: "overlay", onclick: (e) => { if (e.target === overlay) close(null); } }, form);
    overlay.addEventListener("keydown", (e) => { if (e.key === "Escape") close(null); });
    document.body.append(overlay);
    area.focus();
  });
}

function toast(text, err) {
  const t = h("div", { class: `toast${err ? " err" : ""}`, role: "status" }, text);
  document.body.append(t);
  setTimeout(() => t.remove(), 5000);
}

// ---------- Login ----------
function renderLogin(message) {
  const root = document.getElementById("root");
  const pw = h("input", { type: "password", name: "password", autocomplete: "current-password", placeholder: "github_pat_…", required: true, "aria-label": "GitHub-Token" });
  const err = h("div", { class: message ? "notice err" : "hidden" }, message || "");
  const btn = h("button", { class: "btn primary", type: "submit" }, "Verbinden");
  const form = h("form", {
    onsubmit: async (e) => {
      e.preventDefault();
      const t = pw.value.trim();
      if (!t) return;
      btn.disabled = true; btn.textContent = "Prüfe …";
      gh.setToken(t);
      try {
        await gh.checkAccess(OWNER, activeAgents()[0].repo);
        storeToken(t);
        pw.value = "";
        state.connected = true;
        startApp();
      } catch (ex) {
        gh.setToken(null);
        err.className = "notice err";
        err.textContent = ex.status === 401 ? "Token ungültig oder abgelaufen." :
          ex.status === 404 ? "Token hat keinen Zugriff auf das Agent-Repo." : `Verbindung fehlgeschlagen: ${ex.message}`;
        btn.disabled = false; btn.textContent = "Verbinden";
      }
    },
  },
    // Verstecktes Benutzerfeld, damit der Passwortmanager den Token sauber speichert.
    h("input", { type: "text", name: "username", autocomplete: "username", value: "Jarvis-Dashboard", class: "hidden", readonly: true, tabindex: "-1", "aria-hidden": "true" }),
    pw, btn, err);
  root.replaceChildren(h("div", { class: "login" },
    h("div", { class: "panel card" },
      logo("logo"),
      h("h1", {}, "JARVIS"),
      h("p", {}, "Kontrollzentrum für alle Agents. Mit deinem GitHub-Token verbinden, der Passwortmanager füllt ihn aus."),
      form,
      h("div", { class: "fine" }, "Der Token bleibt nur in diesem Tab, auch beim Neuladen. Beim Schließen des Tabs ist er weg. ",
        h("a", { href: "?demo" }, "Demo ansehen")))));
  pw.focus();
}

// ---------- App-Rahmen ----------
const VIEWS = [
  { id: "uebersicht", label: "Übersicht", icon: "home", render: viewOverview },
  { id: "planer", label: "Planer", icon: "calendar", render: viewPlaner },
  { id: "agents", label: "Agents", icon: "agents", render: viewAgents },
  { id: "mailfilter", label: "Mail-Filter", icon: "filter", render: viewMail },
  { id: "diktate", label: "Diktate", icon: "mic", render: viewDiktate },
  { id: "aktivitaet", label: "Aktivität", icon: "activity", render: viewActivity },
  { id: "einstellungen", label: "Einstellungen", icon: "settings", render: viewSettings },
];
function currentView() {
  const id = location.hash.replace(/^#\/?/, "");
  return VIEWS.find((v) => v.id === id) || VIEWS[0];
}

function startApp() {
  window.addEventListener("hashchange", render);
  render();
  load();
}

function render() {
  if (!state.connected) return;
  const view = currentView();
  const root = document.getElementById("root");
  const nav = VIEWS.map((v) => h("button", {
    class: `nav-item${v === view ? " active" : ""}`, onclick: () => { location.hash = `/${v.id}`; },
    "aria-current": v === view ? "page" : null,
  }, icon(v.icon), v.label));

  const liveDot = state.error ? "red" : state.loading && !state.lastUpdate ? "amber" : "green";
  const liveText = DEMO ? "DEMO-MODUS" : state.error ? "VERBINDUNGSFEHLER" : state.lastUpdate ? `LIVE · ${fTime.format(state.lastUpdate)}` : "LÄDT …";

  const body = [];
  if (state.error) body.push(h("div", { class: "notice err" }, `GitHub nicht erreichbar: ${state.error}`));
  for (const m of state.resultErrors) body.push(h("div", { class: "notice" }, m));
  if (!state.lastUpdate && !state.error) body.push(h("div", { class: "empty" }, "Lade Daten von GitHub …"));
  else body.push(view.render());

  root.replaceChildren(h("div", { class: "app" },
    h("nav", { class: "sidebar" }, h("div", { class: "logo" }, logo()), nav, h("div", { class: "spacer" }),
      h("div", { class: "foot" }, DEMO ? "Beispieldaten" : `Konto ${OWNER}`)),
    h("div", { class: "main" },
      h("header", { class: "topbar" },
        h("div", { class: "brand" }, h("h1", {}, "JARVIS KONTROLLZENTRUM"), h("p", {}, "Monitoring & Steuerung aller Agents")),
        h("div", { class: "top-right" },
          h("div", { class: "top-actions" },
            h("button", { class: `btn ghost refresh${state.loading ? " spinning" : ""}`, title: "Daten neu laden", "aria-label": "Aktualisieren", onclick: () => { load(); render(); } },
              icon("refresh"), h("span", { class: "refresh-label" }, "Aktualisieren")),
            h("span", { class: "pill-outline" }, DEMO ? "DEMO / BEISPIEL" : "FALTERMAIER")),
          h("span", { class: "live-state" }, h("span", { class: `dot ${DEMO ? "amber" : liveDot}` }), liveText))),
      h("main", { class: "content" }, h("h1", { class: "page-title" }, view.label), body),
      h("footer", { class: "footer" }, h("div", { class: "line" },
        DEMO ? "Erfundene Beispieldaten · keine Verbindung zu GitHub" :
          `Daten live von GitHub · Token nur in diesem Tab · aktualisiert automatisch${state.lastUpdate ? ` · zuletzt ${fTime.format(state.lastUpdate)}` : ""}`)))));
}

// ---------- Bausteine ----------
function statCard(iconName, color, label, value, small) {
  return h("div", { class: `panel stat c-${color}` },
    h("div", { class: "ico" }, icon(iconName)),
    h("div", { class: "body" }, h("div", { class: "label" }, label),
      h("div", { class: "value" }, value, small ? h("small", {}, ` ${small}`) : null)),
    icon("trend", "trend"));
}

function statusPill(st) {
  return h("span", { class: `status ${st.key}` }, h("span", { class: "dot" }), st.label);
}

function agentRow(cfg, detailed) {
  const st = agentStatus(cfg);
  const runs = state.runs[cfg.id] || [];
  const last = runs[0];
  const rate = cfg.status === "planned" ? null : successRate(cfg);
  const bar = h("div", { class: `bar ${cfg.color === "violet" ? "violet" : ""} ${st.key === "running" ? "indet" : ""}`, title: rate ? `Erfolgsquote 30 Tage: ${rate.ok}/${rate.total}` : "" },
    h("i", { style: { width: st.key === "running" ? null : `${rate ? Math.round((rate.ok / rate.total) * 100) : 0}%` } }));
  const meta = cfg.status === "planned" ? cfg.note :
    last ? `${rate ? `${rate.ok}/${rate.total} ok` : "–"} · ${when(last.created_at)}` : "noch kein Lauf";
  const btn = cfg.status === "planned" ? h("button", { class: "btn", disabled: true }, icon("play"), "Starten") :
    cfg.input ? h("button", { class: "btn", onclick: () => startAgent(cfg) }, icon("mic"), cfg.input.button || "Senden") :
    h("button", { class: "btn", disabled: st.key === "running", onclick: () => startAgent(cfg) }, icon("play"), st.key === "running" ? "Läuft …" : "Starten");
  return h("div", { class: "agent-row" },
    h("div", { class: `agent-ico c-${cfg.color}` }, icon(cfg.icon)),
    h("div", {}, h("div", { class: "agent-name" }, cfg.name), h("div", { class: "agent-desc" }, detailed && state.agentErrors[cfg.id] ? state.agentErrors[cfg.id] : cfg.description)),
    statusPill(st), h("div", { class: "agent-prog" }, bar, h("div", { class: "agent-meta" }, meta)), btn);
}

function activityEvents(limit) {
  const ev = [];
  for (const cfg of activeAgents()) {
    for (const r of state.runs[cfg.id] || []) {
      if (cfg.quiet && r.event === "schedule" && r.conclusion === "success") continue;
      const trigger = r.event === "schedule" ? "Zeitplan" : r.event === "workflow_dispatch" ? "manuell" : r.event;
      ev.push({ t: new Date(r.run_started_at || r.created_at), color: "amber", text: `${cfg.name} gestartet (${trigger})`, url: r.html_url });
      if (r.status === "completed") {
        const res = state.results[r.id];
        let text = `${cfg.name} ${r.conclusion === "success" ? "erfolgreich" : r.conclusion === "cancelled" ? "abgebrochen" : "FEHLGESCHLAGEN"}`;
        if (res && res.totals) text += ` · ${res.totals.candidates} Werbung, ${res.totals.flagged} auffällig`;
        else if (res && res.title) text += ` · ${res.type === "event" ? "Termin" : "Aufgabe"}: ${res.title}`;
        ev.push({ t: new Date(r.updated_at), color: r.conclusion === "success" ? "green" : "red", text, url: r.html_url });
      } else {
        ev.push({ t: new Date(r.updated_at), color: "cyan", text: `${cfg.name} läuft …`, url: r.html_url });
      }
    }
  }
  return ev.sort((a, b) => b.t - a.t).slice(0, limit);
}

function activityList(limit) {
  const ev = activityEvents(limit);
  if (!ev.length) return h("div", { class: "empty" }, "Noch keine Aktivität.");
  return h("ul", { class: "act" }, ev.map((e) => h("li", {},
    h("span", { class: `dot ${e.color}` }),
    h("span", { class: "t" }, when(e.t.toISOString())),
    e.url && e.url !== "#demo" ? h("a", { class: "msg", href: e.url, target: "_blank", rel: "noopener noreferrer" }, e.text) : h("span", { class: "msg" }, e.text))));
}

// Monotone Kurve (Fritsch-Carlson): kein Ueberschwingen unter 0.
function smoothPath(pts) {
  if (pts.length < 2) return "";
  const n = pts.length, dx = [], m = [], t = [];
  for (let i = 0; i < n - 1; i++) { dx[i] = pts[i + 1][0] - pts[i][0]; m[i] = (pts[i + 1][1] - pts[i][1]) / dx[i]; }
  t[0] = m[0]; t[n - 1] = m[n - 2];
  for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (3 * (dx[i - 1] + dx[i])) / ((2 * dx[i] + dx[i - 1]) / m[i - 1] + (dx[i] + 2 * dx[i - 1]) / m[i]);
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < n - 1; i++) {
    const h3 = dx[i] / 3;
    d += ` C${pts[i][0] + h3},${pts[i][1] + h3 * t[i]} ${pts[i + 1][0] - h3},${pts[i + 1][1] - h3 * t[i + 1]} ${pts[i + 1][0]},${pts[i + 1][1]}`;
  }
  return d;
}

function mailChart() {
  const results = resultsFor("mailagent");
  const byDay = new Map();
  for (const r of results) { const k = dayKey(new Date(r.finished_at)); if (!byDay.has(k)) byDay.set(k, r); }
  const days = [];
  for (let i = RESULT_DAYS - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 864e5);
    days.push({ d, r: byDay.get(dayKey(d)) });
  }
  const series = [
    { key: "candidates", color: "#38c8f0", id: "gc" },
    { key: "flagged", color: "#8b7cf6", id: "gv" },
  ];
  const max = Math.max(4, ...days.flatMap((x) => (x.r ? series.map((sr) => x.r.totals[sr.key]) : [0])));
  const step = Math.ceil(max / 4);
  const top = step * 4;

  // Das SVG wird in der echten Breite gezeichnet (1:1), damit Schrift und
  // Linien auf dem Handy nicht verzerrt werden.
  const wrap = h("div", { class: "chart-wrap" });
  let drawnW = 0;
  const draw = (W) => {
    drawnW = W;
    wrap.replaceChildren(...buildChart(W, W < 520 ? 200 : 250));
  };
  const ro = new ResizeObserver(([e]) => {
    const w = Math.round(e.contentRect.width);
    if (w > 0 && Math.abs(w - drawnW) > 4) draw(w);
  });
  ro.observe(wrap);
  draw(860);

  function buildChart(W, H) {
  const L = 34, R = 8, T = 12, B = 28;
  const X = (i) => L + (i * (W - L - R)) / (days.length - 1);
  const Y = (v) => T + (H - T - B) * (1 - v / top);
  const labelEvery = W < 520 ? 3 : 2;

  const svg = s("svg", { class: "chart", viewBox: `0 0 ${W} ${H}`, height: H, role: "img", "aria-label": "Gefilterte Mails pro Tag" },
    s("defs", {}, series.map((sr) => s("linearGradient", { id: sr.id, x1: "0", y1: "0", x2: "0", y2: "1" },
      s("stop", { offset: "0", "stop-color": sr.color, "stop-opacity": ".35" }),
      s("stop", { offset: "1", "stop-color": sr.color, "stop-opacity": "0" })))));
  for (let g = 0; g <= 4; g++) {
    const v = step * g;
    svg.append(s("line", { class: "grid", x1: L, x2: W - R, y1: Y(v), y2: Y(v) }), s("text", { x: L - 10, y: Y(v) + 4, "text-anchor": "end" }, String(v)));
  }
  days.forEach((x, i) => {
    if ((days.length - 1 - i) % labelEvery === 0) svg.append(s("text", { x: X(i), y: H - 8, "text-anchor": i === days.length - 1 ? "end" : "middle" }, fDay.format(x.d)));
  });
  for (const sr of series) {
    const pts = days.map((x, i) => (x.r ? [X(i), Y(x.r.totals[sr.key])] : null)).filter(Boolean);
    if (pts.length >= 2) {
      const line = smoothPath(pts);
      svg.append(s("path", { d: `${line} L${pts[pts.length - 1][0]},${Y(0)} L${pts[0][0]},${Y(0)} Z`, fill: `url(#${sr.id})` }));
      svg.append(s("path", { d: line, fill: "none", stroke: sr.color, "stroke-width": "2.2" }));
    }
    for (const p of pts) svg.append(s("circle", { cx: p[0], cy: p[1], r: pts.length < 2 ? 4 : 2.2, fill: sr.color }));
  }
  const hover = s("line", { class: "hover-line hidden", y1: T, y2: H - B });
  svg.append(hover);

  const tip = h("div", { class: "chart-tip hidden" });
  svg.addEventListener("pointermove", (e) => {
    const box = svg.getBoundingClientRect();
    const vx = ((e.clientX - box.left) / box.width) * W;
    const i = Math.max(0, Math.min(days.length - 1, Math.round(((vx - L) / (W - L - R)) * (days.length - 1))));
    const x = days[i];
    hover.setAttribute("x1", X(i)); hover.setAttribute("x2", X(i)); hover.classList.remove("hidden");
    tip.replaceChildren(h("div", { class: "muted" }, fDayLong.format(x.d)),
      x.r ? [h("div", {}, h("span", { class: "c-cyan" }, "● "), `Werbung: ${x.r.totals.candidates}`),
        h("div", {}, h("span", { class: "c-violet" }, "● "), `Auffällig: ${x.r.totals.flagged}`)] : h("div", {}, "kein Lauf"));
    tip.classList.remove("hidden");
    Object.assign(tip.style, { left: `${(X(i) / W) * box.width}px`, top: `${(Y(x.r ? x.r.totals.candidates : 0) / H) * box.height}px` });
  });
  svg.addEventListener("pointerleave", () => { hover.classList.add("hidden"); tip.classList.add("hidden"); });
  return [svg, tip];
  }

  return h("div", { class: "panel" },
    h("div", { class: "panel-head" }, h("h2", {}, "Mail-Filter · 14 Tage"),
      h("button", { class: "link", onclick: () => { location.hash = "/mailfilter"; } }, "Details", icon("arrow"))),
    h("div", { class: "legend" },
      h("span", {}, h("span", { class: "dot cyan" }), "Werbung erkannt"),
      h("span", {}, h("span", { class: "dot violet" }), "Auffällig (Phishing-Verdacht)")),
    results.length ? wrap : h("div", { class: "empty" }, "Noch keine Ergebnisse. Der nächste Lauf liefert die ersten Daten."));
}

function mailboxRing() {
  const res = resultsFor("mailagent")[0];
  const accounts = res ? res.accounts : [];
  const n = Math.max(accounts.length, 1);
  const cx = 110, cy = 110, r = 88, gapDeg = accounts.length > 1 ? 4 : 0;
  const svg = s("svg", { class: "ring", viewBox: "0 0 220 220", role: "img", "aria-label": "Postfächer erreichbar" },
    s("circle", { cx, cy, r: r + 14, fill: "none", stroke: "#15243b", "stroke-width": "1" }),
    s("circle", { cx, cy, r: r - 14, fill: "none", stroke: "#15243b", "stroke-width": "1" }));
  const arc = (a0, a1) => {
    const p = (a) => [cx + r * Math.cos(((a - 90) * Math.PI) / 180), cy + r * Math.sin(((a - 90) * Math.PI) / 180)];
    const [x0, y0] = p(a0), [x1, y1] = p(a1);
    return `M${x0},${y0} A${r},${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1},${y1}`;
  };
  if (!accounts.length) svg.append(s("circle", { cx, cy, r, fill: "none", stroke: "#1d2c44", "stroke-width": "12" }));
  accounts.forEach((a, i) => {
    const a0 = (i * 360) / n + gapDeg / 2, a1 = ((i + 1) * 360) / n - gapDeg / 2;
    const col = a.status === "ok" ? "#38c8f0" : "#f0616d";
    svg.append(s("path", { d: arc(a0, a1), fill: "none", stroke: col, "stroke-width": "12", "stroke-linecap": "butt" }, s("title", {}, `${a.account}: ${a.status === "ok" ? "erreichbar" : a.error}`)));
  });
  const ok = accounts.filter((a) => a.status === "ok").length;
  svg.append(
    s("text", { x: cx, y: cy - 4, "text-anchor": "middle", fill: "#e8eef8", "font-size": "34", "font-weight": "500" }, res ? `${ok} / ${accounts.length}` : "–"),
    s("text", { x: cx, y: cy + 20, "text-anchor": "middle", fill: "#c5d1e3", "font-size": "13" }, "Postfächer erreichbar"),
    s("text", { x: cx, y: cy + 38, "text-anchor": "middle", fill: "#7d8fab", "font-size": "11" }, res ? `Lauf ${fShort.format(new Date(res.finished_at)).replace(",", "")}` : "noch kein Lauf"));
  const bad = accounts.filter((a) => a.status !== "ok");
  return h("div", { class: "panel" },
    h("div", { class: "panel-head" }, h("h2", {}, "Postfächer")),
    h("div", { class: "ring-wrap" }, svg,
      bad.length ? h("div", { class: "ring-legend" }, bad.map((a) => h("div", { title: a.error || "" }, h("span", { class: "dot red" }), h("span", { class: "acc" }, `${a.account} übersprungen`)))) : null));
}

// ---------- Seiten ----------
function viewOverview() {
  const act = activeAgents();
  const healthy = act.filter((c) => ["ok", "running"].includes(agentStatus(c).key)).length;
  const planned = AGENTS.length - act.length;
  const weekAgo = Date.now() - 7 * 864e5;
  const runs7 = act.reduce((sum, c) => sum + (state.runs[c.id] || []).filter((r) => new Date(r.created_at) >= weekAgo).length, 0);
  const rates = act.map((c) => successRate(c)).filter(Boolean);
  const okAll = rates.reduce((a, r) => a + r.ok, 0), totAll = rates.reduce((a, r) => a + r.total, 0);
  const lastRes = resultsFor("mailagent")[0];

  const alerts = [];
  for (const c of act) {
    const st = agentStatus(c);
    if (["fail", "late"].includes(st.key)) alerts.push(h("div", { class: `notice${st.key === "fail" ? " err" : ""}` }, `${c.name}: ${st.label}${st.detail ? ` · ${st.detail}` : ""}${state.agentErrors[c.id] ? ` (${state.agentErrors[c.id]})` : ""}`));
  }

  return [
    alerts,
    h("div", { class: "stats" },
      statCard("pulse", "cyan", "Agents gesund", `${healthy} / ${act.length}`, planned ? `+${planned} geplant` : ""),
      statCard("zap", "violet", "Läufe · 7 Tage", String(runs7)),
      statCard("check", "green", "Erfolgsquote · 30 T.", totAll ? `${Math.round((okAll / totAll) * 100)} %` : "–"),
      statCard("inbox", "amber", "Werbung erkannt", lastRes ? String(lastRes.totals.candidates) : "–", lastRes ? "letzter Lauf" : "")),
    h("div", { class: "row-3" }, eventsPanel(true), tasksPanel(true)),
    h("div", { class: "row-2" }, mailChart(), mailboxRing()),
    h("div", { class: "row-3" },
      h("div", { class: "panel" },
        h("div", { class: "panel-head" }, h("h2", {}, "Agents"), h("button", { class: "link", onclick: () => { location.hash = "/agents"; } }, "Alle Agents", icon("arrow"))),
        AGENTS.map((c) => agentRow(c, false))),
      h("div", { class: "panel" },
        h("div", { class: "panel-head" }, h("h2", {}, "Live-Aktivität"), h("button", { class: "link", onclick: () => { location.hash = "/aktivitaet"; } }, "Alle anzeigen", icon("arrow"))),
        activityList(6))),
  ];
}

function viewAgents() {
  return AGENTS.map((cfg) => {
    const st = agentStatus(cfg);
    const last = (state.runs[cfg.id] || [])[0];
    const rate = cfg.status === "planned" ? null : successRate(cfg);
    const rows = cfg.status === "planned" ? [["Status", cfg.note]] : [
      ["Zeitplan", cfg.schedule ? cfg.schedule.label : "nur manuell"],
      ["Letzter Lauf", last ? `${when(last.created_at)} · ${last.status === "completed" ? duration(last) : "läuft"} · ${ago(new Date(last.created_at))}` : "–"],
      ["Erfolgsquote 30 Tage", rate ? `${rate.ok} von ${rate.total}` : "–"],
      ["Repo", h("a", { href: `https://github.com/${OWNER}/${cfg.repo}`, target: "_blank", rel: "noopener noreferrer" }, `${OWNER}/${cfg.repo}`)],
      ["Workflow", h("a", { href: `https://github.com/${OWNER}/${cfg.repo}/actions/workflows/${cfg.workflow}`, target: "_blank", rel: "noopener noreferrer" }, cfg.workflow)],
    ];
    if (state.agentErrors[cfg.id]) rows.push(["Fehler", state.agentErrors[cfg.id]]);
    return h("div", { class: "panel" },
      h("div", { class: "panel-head" },
        h("h2", {}, h("span", { class: `c-${cfg.color}` }, icon(cfg.icon, "inline-ico")), " ", cfg.name),
        statusPill(st)),
      h("p", { class: "muted" }, cfg.description),
      h("dl", { class: "kv" }, rows.map(([k, v]) => [h("dt", {}, k), h("dd", {}, v)])),
      cfg.status === "planned" ? null : h("div", { style: { marginTop: "16px" } },
        cfg.input ? h("button", { class: "btn primary", onclick: () => startAgent(cfg) }, icon("mic"), cfg.input.title) :
        h("button", { class: "btn primary", disabled: st.key === "running", onclick: () => startAgent(cfg) }, icon("play"), st.key === "running" ? "Läuft …" : "Jetzt starten")));
  });
}

function viewMail() {
  const results = resultsFor("mailagent");
  if (!results.length) return h("div", { class: "panel" }, h("div", { class: "empty" }, "Noch keine Ergebnisse vorhanden. Die Details werden 14 Tage aufbewahrt und danach automatisch gelöscht."));
  if (!results.some((r) => r.runId === state.ui.run)) state.ui.run = results[0].runId;
  const res = results.find((r) => r.runId === state.ui.run);

  const runSel = h("select", { "aria-label": "Lauf", onchange: (e) => { state.ui.run = Number(e.target.value); render(); } },
    results.map((r) => h("option", { value: r.runId, selected: r.runId === state.ui.run },
      `${fDayLong.format(new Date(r.finished_at))} ${fTime.format(new Date(r.finished_at)).slice(0, 5)} · ${r.totals.candidates + r.totals.flagged} Treffer`)));
  const accSel = h("select", { "aria-label": "Postfach", onchange: (e) => { state.ui.account = e.target.value; render(); } },
    h("option", { value: "" }, "Alle Postfächer"),
    res.accounts.map((a) => h("option", { value: a.account, selected: a.account === state.ui.account }, `${a.account} (${a.items.length})`)));
  const kindSel = h("select", { "aria-label": "Art", onchange: (e) => { state.ui.kind = e.target.value; render(); } },
    [["", "Alle Arten"], ["ad", "Nur Werbung"], ["flagged", "Nur auffällig"], ["failed", "Nur Fehler"]]
      .map(([v, l]) => h("option", { value: v, selected: v === state.ui.kind }, l)));

  const ACTION = {
    candidate: ["Kandidat (Testphase)", "c-cyan"], moved: ["In Papierkorb", "c-green"],
    failed: ["Fehler", "c-red"], flagged: ["Auffällig", "c-violet"],
  };
  const rows = [];
  for (const a of res.accounts) {
    if (state.ui.account && a.account !== state.ui.account) continue;
    for (const it of a.items) {
      if (state.ui.kind === "ad" && !["candidate", "moved"].includes(it.action)) continue;
      if (state.ui.kind && state.ui.kind !== "ad" && it.action !== state.ui.kind) continue;
      const [label, cls] = ACTION[it.action] || [it.action, ""];
      rows.push(h("tr", {},
        h("td", { class: "nowrap" }, a.account),
        h("td", { class: "wrap" }, it.from),
        h("td", { class: "wrap" }, it.subject),
        h("td", { class: "wrap muted" }, it.error ? `${it.reason} · ${it.error}` : it.reason),
        h("td", { class: "nowrap" }, h("span", { class: `tag ${cls}` }, label))));
    }
  }
  const t = res.totals;
  return [
    h("div", { class: "stats" },
      statCard("mail", "cyan", "Mails geprüft", String(t.scanned)),
      statCard("inbox", "amber", "Werbung erkannt", String(t.candidates), res.live_mode ? `${t.moved} verschoben` : "Testphase"),
      statCard("zap", "violet", "Auffällig", String(t.flagged), "nicht gelöscht"),
      statCard("check", t.accounts_ok === t.accounts_total ? "green" : "red", "Postfächer ok", `${t.accounts_ok} / ${t.accounts_total}`)),
    res.live_mode ? null : h("div", { class: "notice" }, `Testphase: Es wird nichts verschoben, nur gemeldet. Live ab ${fDay.format(new Date(res.live_mode_from || "2026-09-28"))}`),
    h("div", { class: "panel" },
      h("div", { class: "toolbar" }, runSel, accSel, kindSel),
      rows.length ? h("div", { class: "table-wrap" }, h("table", {},
        h("thead", {}, h("tr", {}, ["Postfach", "Absender", "Betreff", "Grund", "Status"].map((x) => h("th", {}, x)))),
        h("tbody", {}, rows))) : h("div", { class: "empty" }, "Keine Treffer für diese Auswahl.")),
    h("div", { class: "panel" },
      h("div", { class: "panel-head" }, h("h2", {}, "Postfach-Status")),
      h("div", { class: "table-wrap" }, h("table", {},
        h("thead", {}, h("tr", {}, ["Postfach", "Geprüft", "Treffer", "Status"].map((x) => h("th", {}, x)))),
        h("tbody", {}, res.accounts.map((a) => h("tr", {},
          h("td", { class: "nowrap" }, a.account), h("td", {}, String(a.scanned)), h("td", {}, String(a.items.length)),
          h("td", { class: "wrap" }, a.status === "ok" ? h("span", { class: "tag c-green" }, "erreichbar") : [h("span", { class: "tag c-red" }, "übersprungen"), " ", h("span", { class: "muted" }, a.error || "")]))))))),
  ];
}

// ---------- Planer: Termine & To-dos ----------
function latestSnapshot() {
  return resultsFor("sync")[0] || null;
}

const fWeekday = fmt({ weekday: "long", day: "2-digit", month: "2-digit" });
const fHM = fmt({ hour: "2-digit", minute: "2-digit" });
function dayLabel(key) {
  const today = dayKey(new Date());
  const tomorrow = dayKey(new Date(Date.now() + 864e5));
  if (key === today) return "Heute";
  if (key === tomorrow) return "Morgen";
  return fWeekday.format(new Date(`${key}T12:00:00`));
}
// Tages-Schluessel eines Termins in Berliner Zeit (ganztaegig: Datum direkt).
function eventDayKey(ev) {
  return ev.all_day ? ev.start.slice(0, 10) : dayKey(new Date(ev.start));
}

function snapshotHeader(snap, title, overview) {
  const cfg = AGENTS.find((a) => a.id === "sync");
  const running = cfg && agentStatus(cfg).key === "running";
  return h("div", { class: "panel-head" }, h("h2", {}, title),
    overview ? h("button", { class: "link", onclick: () => { location.hash = "/planer"; } }, "Planer", icon("arrow")) :
      h("div", { class: "head-actions" },
        h("span", { class: "muted small" }, snap ? `Stand ${fHM.format(new Date(snap.finished_at))}` : "noch kein Abgleich"),
        cfg ? h("button", { class: "btn", disabled: running, onclick: () => startAgent(cfg) }, icon("refresh"), running ? "Gleicht ab …" : "Jetzt abgleichen") : null));
}

function eventsPanel(overview) {
  const snap = latestSnapshot();
  const now = Date.now();
  const sortKey = (e) => `${eventDayKey(e)} ${e.all_day ? "00:00" : fHM.format(new Date(e.start))}`;
  let events = snap ? snap.events.filter((e) => new Date(e.all_day ? `${e.end}T00:00:00` : e.end) > now)
    .sort((a, b) => sortKey(a).localeCompare(sortKey(b))) : [];
  if (overview) events = events.slice(0, 5);
  const groups = new Map();
  for (const e of events) {
    const k = eventDayKey(e);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(e);
  }
  const body = !snap ? h("div", { class: "empty" }, "Noch kein Abgleich gelaufen.") :
    !events.length ? h("div", { class: "empty" }, "Keine Termine in den nächsten 14 Tagen.") :
      [...groups].map(([k, list]) => h("div", { class: "day-group" },
        h("div", { class: "day-label" }, dayLabel(k)),
        list.map((e) => h("div", { class: `event${e.holiday ? " holiday" : ""}` },
          h("span", { class: "event-time mono" }, e.all_day ? "ganztägig" : `${fHM.format(new Date(e.start))}–${fHM.format(new Date(e.end))}`),
          h("span", { class: "event-title" },
            e.link ? h("a", { href: e.link, target: "_blank", rel: "noopener noreferrer" }, e.title) : e.title,
            e.location ? h("span", { class: "muted" }, ` · ${e.location}`) : null,
            e.holiday ? h("span", { class: "tag c-green" }, "Feiertag") : null)))));
  return h("div", { class: "panel" }, snapshotHeader(snap, overview ? "Nächste Termine" : "Termine · 14 Tage", overview), body);
}

const PRIO = { 4: "c-red", 3: "c-amber", 2: "c-cyan" };
function taskRow(t) {
  const closing = !!state.closing[t.id];
  const due = t.due_date ? (t.due_date.length > 10 ? fShort.format(new Date(t.due_date)).replace(",", "") : fDay.format(new Date(`${t.due_date}T12:00:00`))) : "";
  return h("div", { class: `task${closing ? " done" : ""}` },
    h("button", { class: `check ${PRIO[t.priority] || ""}`, "aria-label": `„${t.content}“ erledigen`, disabled: closing, onclick: () => closeTask(t) },
      closing ? icon("check") : null),
    h("div", { class: "task-body" },
      h("a", { class: "task-title", href: t.link, target: "_blank", rel: "noopener noreferrer" }, t.content),
      h("div", { class: "task-meta muted" }, [t.project, due, t.recurring ? "wiederkehrend" : ""].filter(Boolean).join(" · "))));
}

function taskGroups(tasks) {
  const today = dayKey(new Date());
  const week = dayKey(new Date(Date.now() + 7 * 864e5));
  const g = { overdue: [], today: [], week: [], later: [], none: [] };
  for (const t of tasks) {
    const d = t.due_date ? t.due_date.slice(0, 10) : null;
    if (!d) g.none.push(t);
    else if (d < today) g.overdue.push(t);
    else if (d === today) g.today.push(t);
    else if (d <= week) g.week.push(t);
    else g.later.push(t);
  }
  const byDue = (a, b) => (a.due_date || "").localeCompare(b.due_date || "") || b.priority - a.priority;
  Object.values(g).forEach((l) => l.sort(byDue));
  return g;
}

function tasksPanel(overview) {
  const snap = latestSnapshot();
  const g = snap ? taskGroups(snap.tasks) : null;
  const sections = overview
    ? [["Überfällig", "overdue"], ["Heute", "today"]]
    : [["Überfällig", "overdue"], ["Heute", "today"], ["Nächste 7 Tage", "week"], ["Später", "later"], ["Ohne Datum", "none"]];
  let body;
  if (!snap) body = h("div", { class: "empty" }, "Noch kein Abgleich gelaufen.");
  else {
    const parts = sections.filter(([, k]) => g[k].length).map(([label, k]) => h("div", { class: "day-group" },
      h("div", { class: `day-label${k === "overdue" ? " c-red" : ""}` }, `${label} (${g[k].length})`),
      g[k].map(taskRow)));
    body = parts.length ? parts : h("div", { class: "empty" }, overview ? "Heute nichts fällig." : "Keine offenen Aufgaben.");
  }
  const title = overview ? `To-dos heute · ${snap ? g.today.length + g.overdue.length : "–"}` : `To-dos · ${snap ? snap.tasks.length : "–"} offen`;
  return h("div", { class: "panel" }, snapshotHeader(snap, title, overview), body);
}

function viewPlaner() {
  const snap = latestSnapshot();
  const cfg = AGENTS.find((a) => a.id === "sync");
  return [
    cfg && state.agentErrors[cfg.id] ? h("div", { class: "notice err" }, state.agentErrors[cfg.id]) : null,
    snap && snap.errors && snap.errors.length ? h("div", { class: "notice err" }, `Letzter Abgleich mit Fehlern: ${snap.errors.join(" · ")}`) : null,
    h("div", { class: "row-3" }, eventsPanel(false), tasksPanel(false)),
    h("p", { class: "muted small" }, "Abgleich alle 2 Stunden zwischen 6 und 22 Uhr oder per Knopf. Ein Haken erledigt die Aufgabe in Todoist, das dauert etwa 30 Sekunden. Termine, die in Google als privat markiert sind, erscheinen als „Beschäftigt“."),
  ];
}

function viewDiktate() {
  const cfg = AGENTS.find((a) => a.id === "watchdiktat");
  const results = resultsFor("watchdiktat");
  const runs = state.runs.watchdiktat || [];
  const pendingRuns = runs.filter((r) => r.status !== "completed");
  const weekAgo = Date.now() - 7 * 864e5;
  const week = results.filter((r) => new Date(r.finished_at) >= weekAgo);
  const SRC = { watch: "Uhr", dashboard: "Dashboard" };
  return [
    state.agentErrors.watchdiktat ? h("div", { class: "notice err" }, state.agentErrors.watchdiktat) : null,
    h("div", { class: "stats" },
      statCard("mic", "green", "Diktate · 7 Tage", String(week.length)),
      statCard("zap", "cyan", "Termine", String(week.filter((r) => r.ok && r.type === "event").length), "7 Tage"),
      statCard("check", "violet", "Aufgaben", String(week.filter((r) => r.ok && r.type === "task").length), "7 Tage"),
      statCard("pulse", week.some((r) => !r.ok) ? "red" : "amber", "Fehler", String(week.filter((r) => !r.ok).length), "7 Tage")),
    h("div", { class: "panel" },
      h("div", { class: "panel-head" }, h("h2", {}, "Verlauf · 14 Tage"),
        cfg ? h("button", { class: "btn primary", onclick: () => startAgent(cfg) }, icon("mic"), cfg.input.title) : null),
      pendingRuns.length ? h("div", { class: "notice" }, `${pendingRuns.length} Diktat${pendingRuns.length > 1 ? "e werden" : " wird"} gerade verarbeitet …`) : null,
      results.length ? h("div", { class: "table-wrap" }, h("table", {},
        h("thead", {}, h("tr", {}, ["Zeit", "Quelle", "Diktat", "Angelegt als", "Wann", "Status"].map((x) => h("th", {}, x)))),
        h("tbody", {}, results.map((r) => h("tr", {},
          h("td", { class: "nowrap mono" }, when(r.received_at || r.finished_at)),
          h("td", { class: "nowrap" }, SRC[r.source] || r.source || "–"),
          h("td", { class: "wrap" }, r.text || "–"),
          h("td", { class: "wrap" }, r.ok ? [h("span", { class: `tag ${r.type === "event" ? "c-cyan" : "c-violet"}` }, r.type === "event" ? "Termin" : "Aufgabe"), " ", r.title] : "–"),
          h("td", { class: "wrap muted" }, r.ok ? [r.when || "", r.target ? ` · ${r.target}` : ""] : ""),
          h("td", { class: "wrap" }, r.ok
            ? (r.link ? h("a", { href: r.link, target: "_blank", rel: "noopener noreferrer" }, "öffnen ↗") : h("span", { class: "tag c-green" }, "angelegt"))
            : [h("span", { class: "tag c-red" }, "Fehler"), " ", h("span", { class: "muted" }, r.error || "")])))))) :
        h("div", { class: "empty" }, "Noch keine Diktate. Die Einträge werden 14 Tage aufbewahrt und danach automatisch gelöscht.")),
  ];
}

function viewActivity() {
  const rows = [];
  for (const cfg of activeAgents()) for (const r of state.runs[cfg.id] || []) rows.push({ cfg, r });
  rows.sort((a, b) => new Date(b.r.created_at) - new Date(a.r.created_at));
  const RES = { success: ["Erfolgreich", "c-green"], failure: ["Fehlgeschlagen", "c-red"], cancelled: ["Abgebrochen", "c-amber"] };
  return h("div", { class: "panel" },
    rows.length ? h("div", { class: "table-wrap" }, h("table", {},
      h("thead", {}, h("tr", {}, ["Agent", "Auslöser", "Start", "Dauer", "Ergebnis", ""].map((x) => h("th", {}, x)))),
      h("tbody", {}, rows.map(({ cfg, r }) => {
        const [label, cls] = r.status !== "completed" ? ["Läuft", "c-cyan"] : RES[r.conclusion] || [r.conclusion || "–", "c-amber"];
        const res = state.results[r.id];
        return h("tr", {},
          h("td", { class: "nowrap" }, cfg.name),
          h("td", {}, r.event === "schedule" ? "Zeitplan" : r.event === "workflow_dispatch" ? "manuell" : r.event),
          h("td", { class: "nowrap mono" }, when(r.created_at)),
          h("td", { class: "nowrap mono" }, r.status === "completed" ? duration(r) : "…"),
          h("td", { class: "nowrap" }, h("span", { class: `tag ${cls}` }, label),
            res && res.totals ? h("span", { class: "muted" }, ` ${res.totals.candidates} Werbung`) :
              res && res.title ? h("span", { class: "muted" }, ` ${res.type === "event" ? "Termin" : "Aufgabe"}`) : null),
          h("td", { class: "nowrap" }, r.html_url && r.html_url !== "#demo" ? h("a", { href: r.html_url, target: "_blank", rel: "noopener noreferrer" }, "Log ↗") : ""));
      })))) : h("div", { class: "empty" }, "Noch keine Läufe."));
}

function viewSettings() {
  return [
    h("div", { class: "panel" },
      h("div", { class: "panel-head" }, h("h2", {}, "Verbindung")),
      h("dl", { class: "kv" },
        h("dt", {}, "GitHub-Konto"), h("dd", {}, OWNER),
        h("dt", {}, "Token"), h("dd", {}, DEMO ? "Demo-Modus, kein Token" : "nur in diesem Tab (sessionStorage), übersteht Neuladen, weg beim Schließen des Tabs"),
        h("dt", {}, "Aktualisierung"), h("dd", {}, "alle 60 Sekunden, während ein Agent läuft alle 8 Sekunden"),
        h("dt", {}, "Ergebnis-Details"), h("dd", {}, "werden 14 Tage bei GitHub aufbewahrt und danach automatisch gelöscht")),
      h("div", { style: { marginTop: "16px", display: "flex", gap: "10px", flexWrap: "wrap" } },
        h("button", { class: "btn", onclick: () => load() }, icon("refresh"), "Jetzt aktualisieren"),
        DEMO ? h("a", { class: "btn", href: "./" }, "Demo verlassen") : h("button", { class: "btn danger", onclick: () => logout() }, icon("logout"), "Abmelden"))),
    h("div", { class: "panel" },
      h("div", { class: "panel-head" }, h("h2", {}, "Token erneuern")),
      h("ol", { class: "steps" },
        h("li", {}, h("a", { href: "https://github.com/settings/personal-access-tokens/new", target: "_blank", rel: "noopener noreferrer" }, "Neuen Fine-grained Token anlegen ↗")),
        h("li", {}, `Resource owner: ${OWNER} · Ablauf: 90 Tage`),
        h("li", {}, `Repository access: Only select repositories → ${activeAgents().map((a) => a.repo).join(", ")}`),
        h("li", {}, "Permissions → Repository → Actions: Read and write (sonst nichts)"),
        h("li", {}, "Token hier beim Login eingeben und im Google-Passwortmanager speichern lassen"),
        h("li", {}, "Den alten Token in GitHub löschen"))),
    h("div", { class: "panel" },
      h("div", { class: "panel-head" }, h("h2", {}, "Neuen Agent hinzufügen")),
      h("p", { class: "muted" }, "Jeder Agent ist ein GitHub-Workflow mit Knopf-Start (workflow_dispatch). Im Dashboard ist er ein Eintrag in config.js, dann erscheint die Karte automatisch. Neues Repo? Dann den Token um dieses Repo erweitern.")),
  ];
}

// ---------- Start ----------
// Neuladen der Seite ohne neues Einloggen: der Token liegt fuer die Dauer
// des Tabs im sessionStorage. Ist er abgelaufen, meldet load() per 401 ab.
if (DEMO) { state.connected = true; startApp(); }
else if (storedToken()) { gh.setToken(storedToken()); state.connected = true; startApp(); }
else renderLogin();
