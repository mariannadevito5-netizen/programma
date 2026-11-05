(function () {
  "use strict";

  const CFG = window.AGENDA_CONFIG || {};
  const TZ = CFG.timeZone || "Europe/Rome";
  const SCOPES = "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/drive.file";
  const LS_DATA = "agenda.data.v1";
  const LS_TOKEN = "agenda.token.v1";
  const LS_VIEW = "agenda.view";
  const COMMUTE_H = 40 / 60; // 20 minuti andata + 20 ritorno per la palestra

  const GIORNI = ["Domenica", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"];
  const GIORNI_BREVI = ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"];
  const MESI = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
  const MESI_BREVI = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];

  const CATS = [
    { key: "lavoro", label: "Lavoro", words: ["turno", "palestra", "lavoro", "reception"] },
    { key: "psico", label: "Psicologa", words: ["serenis", "psicolog", "simona", "seduta", "terapia"] },
    { key: "danza", label: "Danza", words: ["danza", "prove", "nebula", "perypezye", "spettacolo", "coreograf"] },
    { key: "studio", label: "Studio", words: [" pt ", "studio", "tesi", "inglese", "b2", "esame", "lezione", "corso", "teoria", "universit"] },
    { key: "ricarica", label: "Ricarica", words: ["amici", "terme", "lettura", "leggere", "viaggio", "cena", "aperitivo", "cinema", "teatro", "compleanno", "festa", "allenamento"] },
    { key: "soldi", label: "Pagamenti", words: ["pagamento", "rata", "inps", "iva", "€", "bolletta", "affitto"] }
  ];
  const RECHARGE = new Set(["danza", "ricarica"]);
  const GOAL_COLORS = ["studio", "danza", "lavoro", "psico", "ricarica", "soldi"];

  const PRESETS = [
    { id: "split", label: "Turno 10–14 e 16–20", parts: [["10:00", "14:00"], ["16:00", "20:00"]] },
    { id: "m", label: "Turno 9–15", parts: [["09:00", "15:00"]] },
    { id: "p", label: "Turno 15–21", parts: [["15:00", "21:00"]] },
    { id: "c", label: "Turno 12–19", parts: [["12:00", "19:00"]] },
    { id: "sab", label: "Sabato mattina", parts: null },
    { id: "altro", label: "Altro impegno", parts: [] }
  ];

  // ---------- Date ----------
  function pad(n) { return String(n).padStart(2, "0"); }
  function startOfDay(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
  function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function mondayOf(d) { const x = startOfDay(d); return addDays(x, -((x.getDay() + 6) % 7)); }
  function ymd(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function ym(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1); }
  function localIso(d, hhmm) { return ymd(d) + "T" + (hhmm || "00:00") + ":00"; }
  function parseYmd(s) { const [y, m, d] = String(s).split("-").map(Number); return new Date(y, (m || 1) - 1, d || 1); }
  function hm(d) { return pad(d.getHours()) + ":" + pad(d.getMinutes()); }
  function sameDay(a, b) { return ymd(a) === ymd(b); }
  function fmtDay(d) { return GIORNI[d.getDay()] + " " + d.getDate() + " " + MESI[d.getMonth()]; }
  function fmtMonth(key) { const [y, m] = key.split("-").map(Number); return MESI_BREVI[m - 1] + " " + String(y).slice(2); }
  function daysBetween(a, b) { return Math.round((startOfDay(b) - startOfDay(a)) / 86400000); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
  function uid() { return Math.random().toString(36).slice(2, 10); }
  function monthOptions(selected) {
    const out = []; const base = new Date(); base.setDate(1);
    for (let i = -2; i < 14; i++) { const d = new Date(base.getFullYear(), base.getMonth() + i, 1); const k = ym(d); out.push('<option value="' + k + '"' + (k === selected ? " selected" : "") + ">" + fmtMonth(k) + "</option>"); }
    return out.join("");
  }

  // ---------- Dati di partenza ----------
  function step(testo, mese) { return { id: uid(), testo, mese, fatto: false }; }
  function seedData() {
    return {
      version: 1,
      updatedAt: 0,
      settings: { letto: "23:30", sveglia: "07:30", sabatoInizio: "09:00", sabatoFine: "13:00", tema: "chiaro" },
      giorni: {},
      obiettivi: [
        { id: "pt", breve: "PT", nome: "Esame Personal Trainer", colore: "lavoro", scadenza: "2027-01-31", indicativa: false, step: [
          step("Lezioni di teoria 21–22 novembre", "2026-11"),
          step("Giornata di pratica a Milano, 29 novembre", "2026-11"),
          step("Riassunti delle lezioni di novembre", "2026-12"),
          step("Lezioni di teoria 12–13 dicembre", "2026-12"),
          step("Ripasso anatomia e fisiologia", "2026-12"),
          step("Lezioni di teoria 16–17 gennaio", "2027-01"),
          step("Quiz e simulazioni d'esame", "2027-01"),
          step("Esame online", "2027-01")
        ] },
        { id: "b2", breve: "B2", nome: "Inglese B2", colore: "psico", scadenza: "2027-03-31", indicativa: true, step: [
          step("Scegliere ente e data d'esame, poi iscriversi", "2026-11"),
          step("Test di livello per capire da dove parti", "2026-11"),
          step("Grammatica e listening, 2 volte a settimana", "2026-12"),
          step("Mantenimento leggero durante l'esame PT", "2027-01"),
          step("Reading e writing, 3 volte a settimana", "2027-02"),
          step("Prima simulazione completa", "2027-02"),
          step("Speaking e simulazioni ogni settimana", "2027-03"),
          step("Esame B2", "2027-03")
        ] },
        { id: "tesi", breve: "Tesi", nome: "Tesi", colore: "studio", scadenza: "2027-05-15", indicativa: true, step: [
          step("Scegliere l'argomento", "2026-11"),
          step("Parlare con il relatore e confermare l'argomento", "2026-11"),
          step("Chiedere in segreteria la data esatta di consegna", "2026-11"),
          step("Bibliografia di partenza: 15 fonti", "2026-12"),
          step("Indice approvato dal relatore", "2026-12"),
          step("Lettura delle fonti principali", "2027-01"),
          step("Capitolo 1", "2027-02"),
          step("Capitolo 2", "2027-03"),
          step("Capitolo 3 e conclusioni", "2027-04"),
          step("Correzioni del relatore", "2027-04"),
          step("Impaginazione e consegna", "2027-05")
        ] },
        { id: "danza", breve: "Danza", nome: "Storia della danza e laurea", colore: "danza", scadenza: "2027-07-10", indicativa: true, step: [
          step("Procurarsi programma e testi d'esame", "2027-04"),
          step("Lettura del manuale", "2027-05"),
          step("Studio per periodi storici", "2027-06"),
          step("Ripasso finale", "2027-07"),
          step("Esame di storia della danza", "2027-07"),
          step("Laurea", "2027-07")
        ] },
        { id: "smm", breve: "Lavoro SMM", nome: "Primo lavoro pagato da social media manager", colore: "ricarica", scadenza: "", indicativa: true, step: [
          step("Portfolio con 3 lavori migliori", "2026-11"),
          step("Profilo LinkedIn e Instagram professionale aggiornati", "2026-11"),
          step("Lista di 20 realtà da contattare (palestre, scuole di danza, locali)", "2026-12"),
          step("Mandare le prime 5 proposte", "2026-12"),
          step("Mandare altre 5 proposte", "2027-01"),
          step("Primo cliente o primo colloquio", "2027-02")
        ] }
      ]
    };
  }

  // ---------- Stato ----------
  const state = {
    view: "oggi",
    weekStart: mondayOf(new Date()),
    dayFocus: startOfDay(new Date()),
    events: [],
    cal: "idle", // idle | loading | ok | error
    calMsg: "",
    fetchedAt: null,
    sync: "local", // local | saving | saved | error
    data: null,
    openGoal: null,
    confirmDelete: null,
    preset: "split"
  };

  // ---------- Salvataggio locale ----------
  function readLocal() {
    try { const raw = localStorage.getItem(LS_DATA); if (raw) { const d = JSON.parse(raw); if (d && d.version) return d; } } catch (e) {}
    return null;
  }
  function writeLocal() { try { localStorage.setItem(LS_DATA, JSON.stringify(state.data)); } catch (e) {} }

  // ---------- Accesso Google ----------
  function getToken() {
    try { const t = JSON.parse(localStorage.getItem(LS_TOKEN) || "null"); if (t && t.token && t.exp > Date.now() + 60000) return t.token; } catch (e) {}
    return null;
  }
  function hadLogin() { try { return !!localStorage.getItem(LS_TOKEN); } catch (e) { return false; } }
  function redirectUri() { return location.origin + location.pathname.replace(/index\.html$/, ""); }
  function login(silent) {
    if (!CFG.googleClientId) { toast("Manca l'ID client Google: segui il passo 2 della guida."); return; }
    const st = uid() + uid();
    try { sessionStorage.setItem("agenda.oauth.state", st); sessionStorage.setItem("agenda.oauth.view", state.view); } catch (e) {}
    const p = new URLSearchParams({
      client_id: CFG.googleClientId, redirect_uri: redirectUri(), response_type: "token",
      scope: SCOPES, include_granted_scopes: "true", state: st
    });
    if (silent) p.set("prompt", "none");
    location.assign("https://accounts.google.com/o/oauth2/v2/auth?" + p.toString());
  }
  function logout() {
    const t = getToken();
    try { localStorage.removeItem(LS_TOKEN); } catch (e) {}
    if (t) fetch("https://oauth2.googleapis.com/revoke?token=" + encodeURIComponent(t), { method: "POST" }).catch(() => {});
    state.events = []; state.cal = "idle"; state.sync = "local";
    renderAll();
  }
  function handleRedirect() {
    if (!location.hash || location.hash.length < 2) return;
    const h = new URLSearchParams(location.hash.slice(1));
    if (!h.has("access_token") && !h.has("error")) return;
    let expected = null;
    try { expected = sessionStorage.getItem("agenda.oauth.state"); const v = sessionStorage.getItem("agenda.oauth.view"); if (v) state.view = v; } catch (e) {}
    history.replaceState(null, "", location.pathname + location.search);
    if (h.get("state") !== expected) return;
    if (h.has("access_token")) {
      const exp = Date.now() + (Number(h.get("expires_in")) || 3600) * 1000;
      try { localStorage.setItem(LS_TOKEN, JSON.stringify({ token: h.get("access_token"), exp })); } catch (e) {}
    } else {
      try { sessionStorage.setItem("agenda.silent.failed", "1"); } catch (e) {}
    }
  }
  class AuthError extends Error {}
  async function gfetch(url, opts) {
    const token = getToken();
    if (!token) throw new AuthError("no token");
    const res = await fetch(url, Object.assign({}, opts, { headers: Object.assign({ Authorization: "Bearer " + token }, (opts && opts.headers) || {}) }));
    if (res.status === 401) { try { localStorage.setItem(LS_TOKEN, JSON.stringify({ token: "", exp: 0 })); } catch (e) {} throw new AuthError("expired"); }
    if (!res.ok) { const t = await res.text().catch(() => ""); const err = new Error("HTTP " + res.status + " " + t.slice(0, 200)); err.status = res.status; throw err; }
    return res;
  }

  // ---------- Google Fogli ----------
  // I dati stanno in un Foglio Google "Agenda di Mary" nel Drive di Mary:
  // si legge anche dal computer e Claude può leggerlo nei check-in.
  const SHEET_TITLE = "Agenda di Mary";
  const LS_SHEET = "agenda.sheet.v1";
  const LS_DIRTY = "agenda.dirty.v1";
  const H_GOALS = ["ID obiettivo", "Obiettivo", "Nome breve", "Colore", "Scadenza", "Data indicativa", "ID step", "Step", "Mese", "Fatto"];
  const H_DAYS = ["Data", "Priorità 1", "Priorità 2", "Priorità 3", "Fatta 1", "Fatta 2", "Fatta 3"];
  const H_SET = ["Impostazione", "Valore"];
  let sheetId = null, saveTimer = null, saveChain = Promise.resolve(), lastRead = 0;
  try { sheetId = localStorage.getItem(LS_SHEET); } catch (e) {}
  function isDirty() { try { return localStorage.getItem(LS_DIRTY) === "1"; } catch (e) { return false; } }
  function setDirty(v) { try { if (v) localStorage.setItem(LS_DIRTY, "1"); else localStorage.removeItem(LS_DIRTY); } catch (e) {} }
  function yes(v) { return /^(sì|si|x|true|vero|1|fatto|fatta)$/i.test(String(v || "").trim()); }
  function sheetUrl() { return sheetId ? "https://docs.google.com/spreadsheets/d/" + sheetId : null; }
  const SAPI = "https://sheets.googleapis.com/v4/spreadsheets";

  async function sheetFind() {
    if (sheetId) {
      try { await gfetch(SAPI + "/" + sheetId + "?fields=spreadsheetId"); return sheetId; }
      catch (e) { if (e instanceof AuthError) throw e; sheetId = null; }
    }
    const q = encodeURIComponent("name='" + SHEET_TITLE + "' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false");
    const r = await gfetch("https://www.googleapis.com/drive/v3/files?fields=files(id)&orderBy=createdTime&q=" + q);
    const j = await r.json();
    sheetId = j.files && j.files[0] ? j.files[0].id : null;
    if (sheetId) try { localStorage.setItem(LS_SHEET, sheetId); } catch (e) {}
    return sheetId;
  }
  async function sheetCreate() {
    const r = await gfetch(SAPI, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
      properties: { title: SHEET_TITLE, locale: "it_IT", timeZone: TZ },
      sheets: ["Obiettivi", "Priorità", "Impostazioni"].map((t, i) => ({ properties: { sheetId: i, title: t, gridProperties: { frozenRowCount: 1 } } }))
    }) });
    sheetId = (await r.json()).spreadsheetId;
    try { localStorage.setItem(LS_SHEET, sheetId); } catch (e) {}
  }
  function toRows() {
    const d = state.data;
    const goals = [H_GOALS];
    for (const g of d.obiettivi) {
      const base = [g.id, g.nome, g.breve || "", g.colore, g.scadenza || "", g.indicativa ? "sì" : "no"];
      if (!g.step.length) goals.push(base.concat(["", "", "", ""]));
      for (const s of g.step) goals.push(base.concat([s.id, s.testo, s.mese || "", s.fatto ? "sì" : ""]));
    }
    const days = [H_DAYS].concat(Object.keys(d.giorni).sort().map(k => { const g = d.giorni[k]; return [k].concat(g.priorita.slice(0, 3), g.fatte.slice(0, 3).map(x => x ? "sì" : "")); }));
    const set = [H_SET].concat(Object.keys(d.settings).map(k => [k, d.settings[k]]));
    return { goals, days, set };
  }
  function fromRows(goalRows, dayRows, setRows) {
    const d = { version: 1, updatedAt: Date.now(), settings: Object.assign({}, seedData().settings), giorni: {}, obiettivi: [] };
    const byId = {};
    for (const r of (goalRows || []).slice(1)) {
      const name = String(r[1] || "").trim(); if (!name && !r[0]) continue;
      const gid = String(r[0] || "").trim() || name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 20) || uid();
      let g = byId[gid];
      if (!g) {
        g = { id: gid, nome: name || gid, breve: String(r[2] || "").trim(), colore: GOAL_COLORS.includes(String(r[3]).trim()) ? String(r[3]).trim() : GOAL_COLORS[d.obiettivi.length % GOAL_COLORS.length], scadenza: String(r[4] || "").trim(), indicativa: !/^no$/i.test(String(r[5] || "").trim()), step: [] };
        byId[gid] = g; d.obiettivi.push(g);
      }
      const testo = String(r[7] || "").trim();
      if (testo) g.step.push({ id: String(r[6] || "").trim() || uid(), testo, mese: String(r[8] || "").trim().slice(0, 7), fatto: yes(r[9]) });
    }
    for (const g of d.obiettivi) g.step.sort((a, b) => (a.mese || "9").localeCompare(b.mese || "9"));
    for (const r of (dayRows || []).slice(1)) {
      const k = String(r[0] || "").trim(); if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) continue;
      d.giorni[k] = { priorita: [1, 2, 3].map(i => String(r[i] || "")), fatte: [4, 5, 6].map(i => yes(r[i])) };
    }
    for (const r of (setRows || []).slice(1)) { const k = String(r[0] || "").trim(); if (k in d.settings && r[1]) d.settings[k] = String(r[1]).trim(); }
    return d;
  }
  async function sheetRead() {
    const p = ["Obiettivi!A1:J1000", "Priorità!A1:G400", "Impostazioni!A1:B50"].map(x => "ranges=" + encodeURIComponent(x)).join("&");
    const r = await gfetch(SAPI + "/" + sheetId + "/values:batchGet?valueRenderOption=FORMATTED_VALUE&" + p);
    const j = await r.json();
    const v = (j.valueRanges || []).map(x => x.values || []);
    lastRead = Date.now();
    return { empty: (v[0] || []).length <= 1, data: fromRows(v[0], v[1], v[2]) };
  }
  async function sheetWrite() {
    if (!sheetId && !(await sheetFind())) await sheetCreate();
    const rows = toRows();
    await gfetch(SAPI + "/" + sheetId + "/values:batchClear", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ranges: ["Obiettivi!A1:J1000", "Priorità!A1:G400", "Impostazioni!A1:B50"] }) });
    await gfetch(SAPI + "/" + sheetId + "/values:batchUpdate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ valueInputOption: "RAW", data: [
      { range: "Obiettivi!A1", values: rows.goals }, { range: "Priorità!A1", values: rows.days }, { range: "Impostazioni!A1", values: rows.set }
    ] }) });
    setDirty(false); lastRead = Date.now();
  }
  async function syncSheet() {
    if (!getToken()) return;
    try {
      if (isDirty()) { await sheetWrite(); state.sync = "saved"; renderTop(); return; }
      if (!(await sheetFind())) { await sheetWrite(); state.sync = "saved"; renderAll(); return; }
      const res = await sheetRead();
      if (res.empty) await sheetWrite();
      else { state.data = res.data; writeLocal(); }
      state.sync = "saved";
      renderAll();
    } catch (e) {
      state.sync = e instanceof AuthError ? "local" : "error";
      renderTop();
    }
  }
  function changed() {
    state.data.updatedAt = Date.now();
    writeLocal(); setDirty(true);
    if (!getToken()) { state.sync = "local"; renderTop(); return; }
    state.sync = "saving"; renderTop();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveChain = saveChain.then(sheetWrite).then(() => { state.sync = "saved"; }, e => { state.sync = e instanceof AuthError ? "local" : "error"; }).then(renderTop);
    }, 1200);
  }

  // ---------- Google Calendar ----------
  function catOf(title) {
    const t = " " + (title || "").toLowerCase() + " ";
    for (const c of CATS) if (c.words.some(w => t.includes(w))) return c.key;
    return "altro";
  }
  function normalize(raw) {
    const out = [];
    for (const e of raw || []) {
      if (!e || e.status === "cancelled" || !e.start) continue;
      const allDay = !!e.start.date;
      const start = allDay ? parseYmd(e.start.date) : new Date(e.start.dateTime);
      const end = allDay ? parseYmd(e.end && e.end.date ? e.end.date : e.start.date) : new Date(e.end && e.end.dateTime ? e.end.dateTime : e.start.dateTime);
      if (isNaN(start) || isNaN(end)) continue;
      out.push({ id: e.id, title: e.summary || "(senza titolo)", start, end, allDay, free: e.transparency === "transparent", cat: catOf(e.summary) });
    }
    return out.sort((a, b) => (a.allDay === b.allDay ? a.start - b.start : a.allDay ? -1 : 1));
  }
  let calReq = 0;
  async function loadWeek() {
    if (!getToken()) { state.cal = "idle"; renderAll(); return; }
    const my = ++calReq;
    state.cal = state.events.length ? state.cal : "loading";
    renderAll();
    const p = new URLSearchParams({ timeMin: state.weekStart.toISOString(), timeMax: addDays(state.weekStart, 7).toISOString(), singleEvents: "true", orderBy: "startTime", maxResults: "250", timeZone: TZ });
    try {
      const r = await gfetch("https://www.googleapis.com/calendar/v3/calendars/primary/events?" + p.toString());
      const j = await r.json();
      if (my !== calReq) return;
      state.events = normalize(j.items); state.cal = "ok"; state.fetchedAt = Date.now();
    } catch (e) {
      if (my !== calReq) return;
      state.events = [];
      if (e instanceof AuthError) { state.cal = "idle"; }
      else { state.cal = "error"; state.calMsg = e.status === 403 ? "Google ha rifiutato la richiesta. Controlla che l'API Calendar sia attiva (guida, passo 2)." : "Non riesco a leggere il calendario. Controlla la connessione e riprova."; }
    }
    renderAll();
  }
  async function createEvent(summary, day, a, b, colorId) {
    const body = { summary, start: { dateTime: localIso(day, a), timeZone: TZ }, end: { dateTime: localIso(day, b), timeZone: TZ } };
    if (colorId) body.colorId = colorId;
    await gfetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  }

  // ---------- Calcoli ----------
  function eventsOn(day) {
    const s = startOfDay(day), e = addDays(s, 1);
    return state.events.filter(ev => ev.allDay ? ev.start <= s && ev.end > s : ev.start < e && ev.end > s);
  }
  function dayStats(day) {
    const s = startOfDay(day), e = addDays(s, 1);
    const evs = eventsOn(day);
    let hours = 0, work = false, late = false, early = false, recharge = false;
    for (const ev of evs) {
      if (RECHARGE.has(ev.cat)) recharge = true;
      if (ev.allDay || ev.free) continue;
      const a = Math.max(ev.start, s), b = Math.min(ev.end, e);
      hours += Math.max(0, (b - a) / 3600000);
      if (ev.cat === "lavoro") work = true;
      if (ev.end > e || (sameDay(ev.end, s) && ev.end.getHours() * 60 + ev.end.getMinutes() > 22 * 60 + 30)) late = true;
      if (sameDay(ev.start, s) && ev.start.getHours() < 8) early = true;
    }
    if (work) hours += COMMUTE_H;
    const busy = evs.filter(ev => !ev.allDay && !ev.free);
    const overlap = busy.some((a, i) => busy.some((b, j) => j > i && a.start < b.end && b.start < a.end));
    const level = hours <= 0 ? "none" : hours <= 6 ? "ok" : hours <= 9.5 ? "warn" : "bad";
    return { evs, hours, level, late, early, recharge, overlap };
  }
  const LEVEL_TXT = { none: "Libero", ok: "Leggero", warn: "Pieno", bad: "Al limite" };
  function hoursTxt(h) { if (h <= 0) return "0 h"; return String(Math.round(h * 2) / 2).replace(".", ",") + " h"; }

  function goalProgress(g) {
    const total = g.step.length, done = g.step.filter(s => s.fatto).length;
    const key = ym(new Date());
    const due = g.step.filter(s => s.mese && s.mese < key).length;
    const lateBy = Math.max(0, g.step.filter(s => s.mese && s.mese < key && !s.fatto).length);
    const next = g.step.find(s => !s.fatto) || null;
    return { total, done, pct: total ? Math.round((done / total) * 100) : 0, due, lateBy, next };
  }
  function overall() {
    const gs = state.data.obiettivi;
    const total = gs.reduce((a, g) => a + g.step.length, 0), done = gs.reduce((a, g) => a + g.step.filter(s => s.fatto).length, 0);
    return { total, done, pct: total ? Math.round((done / total) * 100) : 0 };
  }
  function monthSteps() {
    const key = ym(new Date()); const out = [];
    for (const g of state.data.obiettivi) for (const s of g.step) if (s.mese && s.mese <= key && !s.fatto) out.push({ g, s, late: s.mese < key });
    return out;
  }

  // ---------- Cerchi ----------
  function ring(pct, color, size) {
    const r = 52, c = 2 * Math.PI * r, off = c * (1 - Math.max(0, Math.min(100, pct)) / 100);
    return '<div class="ring ' + size + '" role="img" aria-label="' + pct + ' per cento"><svg viewBox="0 0 120 120"><circle class="track" cx="60" cy="60" r="' + r + '" stroke-width="12"></circle>' +
      '<circle class="arc" cx="60" cy="60" r="' + r + '" stroke-width="12" stroke="var(--c-' + color + ')" stroke-dasharray="' + c.toFixed(1) + '" stroke-dashoffset="' + off.toFixed(1) + '"></circle></svg><span class="pct">' + pct + "%</span></div>";
  }

  // ---------- Barra in alto ----------
  function renderTop() {
    const el = document.getElementById("sync");
    if (!el) return;
    const logged = !!getToken();
    el.textContent = !logged ? "Salvato su questo dispositivo" : state.sync === "saving" ? "Salvo sul Foglio Google…" : state.sync === "error" ? "Google non risponde, salvato qui" : "Salvato sul Foglio Google";
  }
  function loginCard() {
    if (!CFG.googleClientId) return '<div class="notice info"><strong>Google non è ancora collegato.</strong><span class="muted">Obiettivi e priorità funzionano già e restano su questo dispositivo. Per vedere il calendario e salvare su Google segui il passo 2 della guida.</span></div>';
    return '<div class="notice info"><strong>' + (hadLogin() ? "Accedi di nuovo a Google" : "Collega il tuo Google Calendar") + '</strong><span class="muted">' + (hadLogin() ? "L'accesso dura circa un'ora, poi Google lo richiede per sicurezza." : "Vedrai i tuoi eventi e i dati si salveranno in un Foglio Google, leggibile anche dal computer.") + '</span><div><button class="btn sm" data-login>Accedi con Google</button></div></div>';
  }
  function calNotice() {
    if (state.cal === "idle") return loginCard();
    if (state.cal === "loading") return '<p class="muted">Leggo il tuo Google Calendar…</p>';
    if (state.cal === "error") return '<div class="notice warn"><strong>' + esc(state.calMsg) + '</strong><div><button class="btn sm ghost" data-reload>Riprova</button></div></div>';
    return "";
  }
  function evRow(ev) {
    const time = ev.allDay ? "tutto il giorno" : hm(ev.start) + "–" + hm(ev.end);
    return '<div class="ev' + (ev.allDay ? " allday" : "") + '"><span class="dot" style="background:var(--c-' + ev.cat + ')"></span><span class="t">' + time + '</span><span class="n">' + esc(ev.title) + "</span></div>";
  }

  // ---------- Vista Oggi ----------
  function renderOggi() {
    const el = document.getElementById("view-oggi");
    const d = state.dayFocus, key = ymd(d);
    const st = dayStats(d);
    const today = sameDay(d, new Date());
    const g = state.data.giorni[key] || { priorita: ["", "", ""], fatte: [false, false, false] };
    const ok = state.cal === "ok";
    const tot = overall();

    let html = '<div class="row between"><button class="iconbtn" data-day="-1" aria-label="Giorno prima">‹</button>' +
      '<div class="center"><p class="eyebrow">' + (today ? "Oggi" : sameDay(d, addDays(new Date(), 1)) ? "Domani" : "Giorno") + "</p><h1>" + esc(fmtDay(d)) + "</h1></div>" +
      '<button class="iconbtn" data-day="1" aria-label="Giorno dopo">›</button></div>';
    html += calNotice();
    if (ok) {
      html += '<div class="row wrapx" style="justify-content:center"><span class="chip ' + (st.level === "none" ? "soft" : st.level) + '">' + LEVEL_TXT[st.level] + " · " + hoursTxt(st.hours) + " impegnate</span>" + (st.recharge ? '<span class="chip ok">Ricarica in programma</span>' : "") + "</div>";
      if (st.overlap) html += '<div class="notice bad"><strong>Due impegni si sovrappongono.</strong><span>Controlla l\'agenda qui sotto e sposta quello che non è fisso.</span></div>';
      if (st.level === "bad") html += '<div class="notice bad"><strong>Giornata al limite.</strong><span>Tieni solo le cose fisse e una priorità. Il resto spostalo su un giorno verde.</span></div>';
    }

    html += '<div class="card"><h3>Le 3 priorità</h3>';
    for (let i = 0; i < 3; i++) {
      html += '<div class="check' + (g.fatte[i] ? " done" : "") + '"><input type="checkbox" id="pf' + i + '" aria-label="Fatta"' + (g.fatte[i] ? " checked" : "") + '><input type="text" id="pt' + i + '" maxlength="120" placeholder="' + ["La cosa più importante", "Seconda cosa", "Terza cosa"][i] + '" value="' + esc(g.priorita[i] || "") + '"><span></span></div>';
    }
    html += "</div>";

    html += '<div class="card"><h3>Agenda</h3><div class="timeline">';
    if (ok) html += st.evs.length ? st.evs.map(evRow).join("") : '<p class="muted">Nessun evento in calendario. Scegli una cosa che ti ricarica.</p>';
    else html += '<p class="muted">Gli eventi compaiono qui quando il calendario è collegato.</p>';
    html += "</div></div>";

    const ms = monthSteps();
    html += '<div class="card"><div class="row between"><h3>Step di questo mese</h3><span class="chip soft">' + tot.pct + "% di tutto</span></div>";
    html += ms.length ? ms.slice(0, 5).map(x => '<div class="check"><input type="checkbox" data-step="' + x.g.id + ":" + x.s.id + '" aria-label="Fatto"><span class="txt">' + esc(x.s.testo) + ' <span class="muted small">· ' + esc(x.g.nome) + '</span></span><span class="meta">' + (x.late ? '<span class="chip warn">indietro</span>' : "") + "</span></div>").join("") + (ms.length > 5 ? '<button class="linkbtn" data-view-go="obiettivi">Vedi tutti (' + ms.length + ")</button>" : "")
      : '<p class="muted">Tutti gli step del mese sono fatti. Ottimo lavoro.</p>';
    html += "</div>";

    const s = state.data.settings;
    html += '<div class="card"><h3>Sonno</h3><div class="sleep"><div><p class="eyebrow">A letto</p><p class="big">' + esc(s.letto) + '</p></div><div class="muted">→</div><div><p class="eyebrow">Sveglia</p><p class="big">' + esc(s.sveglia) + "</p></div></div>" +
      (ok && st.late ? '<p class="notice warn">Stasera finisci tardi. Domattina non mettere niente prima delle 10, se puoi.</p>' : '<p class="muted small">Stesso orario tutti i giorni, anche la domenica: è la regola che ti protegge di più.</p>') + "</div>";

    el.innerHTML = html;
    for (let i = 0; i < 3; i++) {
      document.getElementById("pf" + i).onchange = savePriorities;
      document.getElementById("pt" + i).onchange = savePriorities;
    }
  }
  function savePriorities() {
    const key = ymd(state.dayFocus);
    const v = { priorita: [0, 1, 2].map(i => document.getElementById("pt" + i).value.trim()), fatte: [0, 1, 2].map(i => document.getElementById("pf" + i).checked) };
    const empty = v.priorita.every(x => !x) && v.fatte.every(x => !x);
    if (empty) delete state.data.giorni[key]; else state.data.giorni[key] = v;
    pruneDays();
    changed();
    renderOggi();
  }
  function pruneDays() {
    const limit = ymd(addDays(new Date(), -60));
    for (const k of Object.keys(state.data.giorni)) if (k < limit) delete state.data.giorni[k];
  }
  function moveDay(n) {
    state.dayFocus = addDays(state.dayFocus, n);
    const ws = mondayOf(state.dayFocus);
    if (ymd(ws) !== ymd(state.weekStart)) { state.weekStart = ws; state.events = []; loadWeek(); }
    renderAll();
  }

  // ---------- Vista Settimana ----------
  function renderSettimana() {
    const el = document.getElementById("view-settimana");
    const ws = state.weekStart, we = addDays(ws, 6);
    const days = [0, 1, 2, 3, 4, 5, 6].map(i => addDays(ws, i));
    const stats = days.map(dayStats);
    const ok = state.cal === "ok";
    const total = stats.reduce((a, s) => a + s.hours, 0);
    const red = stats.filter(s => s.level === "bad").length, yellow = stats.filter(s => s.level === "warn").length;
    const recharge = stats.some(s => s.recharge);

    let html = '<div class="row between"><button class="iconbtn" data-week="-1" aria-label="Settimana prima">‹</button>' +
      '<div class="center"><p class="eyebrow">Settimana</p><h1>' + ws.getDate() + (ws.getMonth() !== we.getMonth() ? " " + MESI_BREVI[ws.getMonth()] : "") + "–" + we.getDate() + " " + MESI[we.getMonth()] + "</h1></div>" +
      '<button class="iconbtn" data-week="1" aria-label="Settimana dopo">›</button></div>';
    html += calNotice();

    html += '<div class="card"><div class="strip">' + days.map((d, i) => {
      const s = stats[i], h = ok ? Math.min(100, (s.hours / 12) * 100) : 0;
      return '<button class="col' + (sameDay(d, new Date()) ? " today" : "") + '" data-jump="' + ymd(d) + '" aria-label="' + esc(fmtDay(d)) + ", " + LEVEL_TXT[s.level] + '"><div class="bar"><div class="fill ' + s.level + '" style="height:' + h + '%"></div></div><span class="lbl">' + GIORNI_BREVI[d.getDay()] + " " + d.getDate() + "</span></button>";
    }).join("") + "</div>";
    if (ok) html += '<p class="muted small">' + hoursTxt(total) + " impegnate in tutto, viaggi per la palestra compresi. " + (red ? red + (red === 1 ? " giorno al limite." : " giorni al limite.") : yellow ? yellow + (yellow === 1 ? " giorno pieno." : " giorni pieni.") : "Settimana leggera.") + "</p>";
    html += "</div>";

    if (ok && red >= 2) html += '<div class="notice bad"><strong>Questa settimana rischi il sovraccarico.</strong><span>Hai ' + red + " giorni al limite. Sposta o togli almeno un impegno non fisso prima di ammalarti.</span></div>";
    if (ok && !recharge) html += '<div class="notice warn"><strong>Manca una cosa che ti ricarica.</strong><span>Metti in calendario un momento tra amici, danza, lettura o terme. La domenica è libera.</span></div>';

    html += days.map((d, i) => {
      const s = stats[i], flags = [];
      if (s.overlap) flags.push('<span class="chip bad">Impegni sovrapposti</span>');
      if (s.late) flags.push('<span class="chip warn">Finisci tardi</span>');
      if (s.early) flags.push('<span class="chip warn">Inizi presto</span>');
      if (s.recharge) flags.push('<span class="chip ok">Ricarica</span>');
      return '<div class="card day' + (sameDay(d, new Date()) ? " today" : "") + '" id="d-' + ymd(d) + '"><div class="day-head"><span class="day-name">' + GIORNI[d.getDay()] + " " + d.getDate() + "</span>" +
        (ok ? '<span class="chip ' + (s.level === "none" ? "soft" : s.level) + '">' + LEVEL_TXT[s.level] + " · " + hoursTxt(s.hours) + "</span>" : "") + "</div>" +
        (flags.length ? '<div class="flags">' + flags.join("") + "</div>" : "") +
        (ok ? (s.evs.length ? s.evs.map(evRow).join("") : '<p class="empty-day">Niente in calendario.</p>') : "") +
        '<div><button class="btn sm ghost" data-add="' + ymd(d) + '">+ Aggiungi</button></div></div>';
    }).join("");
    html += '<div class="legend">' + CATS.concat([{ key: "altro", label: "Altro" }]).map(c => '<span><i style="background:var(--c-' + c.key + ')"></i>' + c.label + "</span>").join("") + "</div>";
    if (ok && state.fetchedAt) html += '<p class="muted small">Calendario aggiornato alle ' + hm(new Date(state.fetchedAt)) + '. <button class="linkbtn" data-reload>Aggiorna</button></p>';
    el.innerHTML = html;
  }
  function moveWeek(n) { state.weekStart = addDays(state.weekStart, 7 * n); state.events = []; loadWeek(); }

  // ---------- Vista Obiettivi ----------
  function renderObiettivi() {
    const el = document.getElementById("view-obiettivi");
    const tot = overall();
    const gs = state.data.obiettivi;
    let html = '<div><p class="eyebrow">Fino a luglio 2027</p><h1>Obiettivi</h1></div>';
    html += '<div class="card"><div class="hero-ring">' + ring(tot.pct, "studio", "lg") + '<div class="row" style="flex-direction:column;align-items:flex-start;gap:6px;min-width:0"><h2>' + tot.done + (tot.done === 1 ? " step fatto su " : " step fatti su ") + tot.total + '</h2><p class="muted">' + motto(tot.pct) + "</p></div></div>" +
      '<div class="mini-rings">' + gs.map(g => '<button data-open="' + g.id + '">' + ring(goalProgress(g).pct, g.colore, "sm") + '<span class="name">' + esc(shortName(g)) + "</span></button>").join("") + "</div></div>";

    html += gs.map(g => goalCard(g)).join("");
    html += '<div class="card"><h3>Nuovo obiettivo</h3><div class="field"><label for="ng-name">Nome</label><input id="ng-name" type="text" maxlength="80" placeholder="Es. Spettacolo di danza a giugno"></div><div class="field"><label for="ng-date">Scadenza (facoltativa)</label><input id="ng-date" type="date"></div><div><button class="btn sm" data-newgoal>Aggiungi obiettivo</button></div></div>';
    el.innerHTML = html;
  }
  function shortName(g) { return g.breve || (g.nome.length > 12 ? g.nome.split(" ")[0] : g.nome); }
  function motto(p) {
    if (p === 0) return "Si parte dal primo step. Uno solo, oggi.";
    if (p < 25) return "Sei partita. Ogni step spuntato conta.";
    if (p < 50) return "Stai costruendo il ritmo. Continua così.";
    if (p < 75) return "Più di metà strada alle spalle.";
    if (p < 100) return "Ultimo tratto. Ci sei quasi.";
    return "Tutto fatto. Festeggia davvero.";
  }
  function goalCard(g) {
    const p = goalProgress(g), open = state.openGoal === g.id;
    const d = g.scadenza ? parseYmd(g.scadenza) : null;
    const left = d ? daysBetween(new Date(), d) : null;
    const when = d ? (left < 0 ? "Scadenza passata" : left > 13 ? Math.floor(left / 7) + " settimane" : left + (left === 1 ? " giorno" : " giorni")) : "Senza scadenza";
    const status = p.pct === 100 ? '<span class="chip ok">Completato</span>' : p.lateBy ? '<span class="chip warn">Indietro di ' + p.lateBy + " step</span>" : '<span class="chip ok">In linea</span>';
    let html = '<div class="card" id="g-' + g.id + '"><button class="goal-head" data-open="' + g.id + '" aria-expanded="' + open + '">' + ring(p.pct, g.colore, "sm") +
      '<span class="info"><span class="h2">' + esc(g.nome) + '</span><span class="muted small">' + (d ? esc(fmtDay(d)) + (g.indicativa ? " · data indicativa" : "") + " · " : "") + when + "</span><span class=\"row wrapx\" style=\"gap:6px\">" + status + '<span class="chip soft">' + p.done + "/" + p.total + "</span></span></span></button>";
    if (!open && p.next) html += '<p class="goal-next"><span class="muted">Prossimo step:</span> ' + esc(p.next.testo) + "</p>";
    if (open) {
      const key = ym(new Date());
      html += '<div class="goal-body">';
      html += g.step.map(s => '<div class="check' + (s.fatto ? " done" : "") + '"><input type="checkbox" data-step="' + g.id + ":" + s.id + '" aria-label="Fatto"' + (s.fatto ? " checked" : "") + '><span class="txt">' + esc(s.testo) + '</span><span class="meta">' + (s.mese ? '<span class="' + (s.mese === key ? "chip soft" : "") + '">' + fmtMonth(s.mese) + "</span>" : "") + '<button class="del" data-delstep="' + g.id + ":" + s.id + '" aria-label="Elimina step">×</button></span></div>').join("");
      html += '<div class="addstep"><input type="text" id="ns-' + g.id + '" maxlength="120" placeholder="Nuovo step" aria-label="Nuovo step"><select id="nm-' + g.id + '" aria-label="Mese">' + monthOptions(key) + '</select><button class="btn sm" data-addstep="' + g.id + '">Aggiungi</button></div>';
      html += '<div class="two"><div class="field"><label for="gd-' + g.id + '">Scadenza</label><input type="date" id="gd-' + g.id + '" value="' + esc(g.scadenza) + '"></div><div class="field"><label for="gi-' + g.id + '">Data</label><select id="gi-' + g.id + '"><option value="1"' + (g.indicativa ? " selected" : "") + '>Indicativa</option><option value="0"' + (g.indicativa ? "" : " selected") + ">Confermata</option></select></div></div>";
      html += '<div class="row wrapx"><button class="btn sm ghost" data-savegoal="' + g.id + '">Salva scadenza</button>' +
        (state.confirmDelete === g.id ? '<button class="btn sm danger" data-delgoal="' + g.id + '">Conferma: elimina obiettivo</button><button class="linkbtn" data-canceldel>Annulla</button>' : '<button class="linkbtn" data-askdel="' + g.id + '" style="color:var(--bad)">Elimina obiettivo</button>') + "</div>";
      html += "</div>";
    }
    return html + "</div>";
  }
  function findStep(ref) { const [gid, sid] = ref.split(":"); const g = state.data.obiettivi.find(x => x.id === gid); return g ? { g, s: g.step.find(x => x.id === sid) } : {}; }
  function toggleStep(ref, val) {
    const { g, s } = findStep(ref); if (!s) return;
    const before = goalProgress(g).pct;
    s.fatto = val; changed();
    const after = goalProgress(g).pct;
    if (val) toast(after === 100 ? g.nome + ": obiettivo raggiunto!" : "Bene! " + shortName(g) + " al " + after + "%");
    renderAll();
    if (before !== after) animateRings();
  }
  function animateRings() {
    // il cerchio parte dal valore precedente: un frame a vuoto fa partire la transizione
    document.querySelectorAll(".ring .arc").forEach(a => { const off = a.getAttribute("stroke-dashoffset"); a.style.strokeDashoffset = a.getAttribute("stroke-dasharray"); requestAnimationFrame(() => requestAnimationFrame(() => { a.style.strokeDashoffset = off; })); });
  }

  // ---------- Aggiungi al calendario ----------
  function openAdd(day) {
    const d = day || state.dayFocus;
    document.getElementById("add-date").value = ymd(d);
    state.preset = d.getDay() === 6 ? "sab" : "split";
    document.getElementById("add-error").hidden = true;
    renderPresets();
    document.getElementById("add-sheet").hidden = false;
  }
  function presetParts(p) {
    if (p.id === "sab") return [[state.data.settings.sabatoInizio, state.data.settings.sabatoFine]];
    if (p.id === "altro") return [[document.getElementById("add-start").value, document.getElementById("add-end").value]];
    return p.parts;
  }
  function renderPresets() {
    const s = state.data.settings;
    document.getElementById("presets").innerHTML = PRESETS.map(p => '<button class="preset" data-preset="' + p.id + '" aria-pressed="' + (state.preset === p.id) + '">' + esc(p.id === "sab" ? "Sabato " + s.sabatoInizio + "–" + s.sabatoFine : p.label) + "</button>").join("");
    document.getElementById("custom-fields").hidden = state.preset !== "altro";
    updateSummary();
  }
  function updateSummary() {
    const p = PRESETS.find(x => x.id === state.preset), v = document.getElementById("add-date").value;
    const title = p.id === "altro" ? (document.getElementById("add-title").value.trim() || "…") : "Turno palestra";
    document.getElementById("add-summary").textContent = v ? "Aggiungo \"" + title + "\" " + fmtDay(parseYmd(v)).toLowerCase() + ", " + presetParts(p).map(x => x[0] + "–" + x[1]).join(" e ") + "." : "Scegli il giorno.";
  }
  async function confirmAdd() {
    const err = document.getElementById("add-error"); err.hidden = true;
    const v = document.getElementById("add-date").value;
    const p = PRESETS.find(x => x.id === state.preset), parts = presetParts(p);
    const title = p.id === "altro" ? document.getElementById("add-title").value.trim() : "Turno palestra";
    const fail = m => { err.textContent = m; err.hidden = false; };
    if (!v) return fail("Scegli il giorno.");
    if (!title) return fail("Scrivi un titolo per l'impegno.");
    if (parts.some(x => !x[0] || !x[1] || x[1] <= x[0])) return fail("L'orario di fine deve essere dopo l'inizio.");
    if (!getToken()) return fail("Prima accedi con Google dalla schermata Oggi o Settimana.");
    const btn = document.getElementById("add-confirm"); btn.disabled = true; btn.textContent = "Aggiungo…";
    let done = 0;
    try {
      for (const [a, b] of parts) { await createEvent(title, parseYmd(v), a, b, p.id === "altro" ? null : "7"); done++; }
      document.getElementById("add-sheet").hidden = true;
      toast(done > 1 ? "Aggiunti " + done + " eventi al calendario" : "Aggiunto al calendario");
      const ws = mondayOf(parseYmd(v));
      if (ymd(ws) !== ymd(state.weekStart)) { state.weekStart = ws; state.events = []; }
      loadWeek();
    } catch (e) {
      fail((done ? "Ho aggiunto " + done + " evento su " + parts.length + ". " : "") + (e instanceof AuthError ? "L'accesso a Google è scaduto: accedi di nuovo e riprova." : "Google Calendar non ha risposto. Controlla la settimana prima di riprovare."));
    }
    btn.disabled = false; btn.textContent = "Aggiungi";
  }

  // ---------- Impostazioni ----------
  function openSettings() {
    const s = state.data.settings;
    document.getElementById("set-letto").value = s.letto;
    document.getElementById("set-sveglia").value = s.sveglia;
    document.getElementById("set-sab-a").value = s.sabatoInizio;
    document.getElementById("set-sab-b").value = s.sabatoFine;
    document.getElementById("set-account").innerHTML = getToken() ? '<button class="btn ghost sm" id="do-logout">Esci da Google</button>' : CFG.googleClientId ? '<button class="btn sm" data-login>Accedi con Google</button>' : '<span class="muted small">Google non è ancora configurato (guida, passo 2).</span>';
    const url = sheetUrl();
    if (getToken() && url) document.getElementById("set-account").insertAdjacentHTML("beforeend", ' <a class="btn ghost sm" href="' + url + '" target="_blank" rel="noopener">Apri il Foglio dati</a>');
    const lo = document.getElementById("do-logout"); if (lo) lo.onclick = () => { logout(); document.getElementById("set-sheet").hidden = true; };
    document.getElementById("set-sheet").hidden = false;
  }
  function saveSettings() {
    const s = state.data.settings;
    s.letto = document.getElementById("set-letto").value || s.letto;
    s.sveglia = document.getElementById("set-sveglia").value || s.sveglia;
    s.sabatoInizio = document.getElementById("set-sab-a").value || s.sabatoInizio;
    s.sabatoFine = document.getElementById("set-sab-b").value || s.sabatoFine;
    changed();
    document.getElementById("set-sheet").hidden = true;
    toast("Impostazioni salvate");
    renderAll();
  }

  // ---------- Generale ----------
  let toastTimer = null;
  function toast(t) { const el = document.getElementById("toast"); el.textContent = t; el.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, 2600); }
  function setView(v) {
    if (!["oggi", "settimana", "obiettivi"].includes(v)) v = "oggi";
    state.view = v;
    try { localStorage.setItem(LS_VIEW, v); } catch (e) {}
    ["oggi", "settimana", "obiettivi"].forEach(k => {
      document.getElementById("view-" + k).hidden = k !== v;
      const t = document.getElementById("tab-" + k);
      if (k === v) t.setAttribute("aria-current", "page"); else t.removeAttribute("aria-current");
    });
    renderAll();
  }
  const THEME_COLOR = { chiaro: "#4A3FCF", notte: "#0E2533", studio: "#D9466F" };
  function applyTheme() {
    const t = THEME_COLOR[state.data.settings.tema] ? state.data.settings.tema : "chiaro";
    if (document.documentElement.dataset.tema !== t) document.documentElement.dataset.tema = t;
    const m = document.querySelector('meta[name="theme-color"]'); if (m) m.setAttribute("content", THEME_COLOR[t]);
    document.querySelectorAll(".theme-opt").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.tema === t)));
  }
  function renderAll() {
    applyTheme();
    renderTop();
    if (state.view === "oggi") renderOggi();
    if (state.view === "settimana") renderSettimana();
    if (state.view === "obiettivi") renderObiettivi();
  }

  // Un solo gestore per tutti i clic della pagina
  document.addEventListener("click", e => {
    const t = e.target.closest("button, [data-step]");
    if (!t) return;
    const ds = t.dataset;
    if (ds.view) { setView(ds.view); window.scrollTo(0, 0); }
    else if (ds.viewGo) { setView(ds.viewGo); window.scrollTo(0, 0); }
    else if (ds.tema) { state.data.settings.tema = ds.tema; changed(); renderAll(); }
    else if ("login" in ds) login(false);
    else if ("reload" in ds) loadWeek();
    else if (ds.day) moveDay(Number(ds.day));
    else if (ds.week) moveWeek(Number(ds.week));
    else if (ds.jump) { const el = document.getElementById("d-" + ds.jump); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); }
    else if (ds.add) openAdd(parseYmd(ds.add));
    else if (ds.preset) { state.preset = ds.preset; renderPresets(); }
    else if (ds.open) {
      state.openGoal = state.openGoal === ds.open && t.classList.contains("goal-head") ? null : ds.open;
      state.confirmDelete = null;
      if (state.view !== "obiettivi") setView("obiettivi"); else renderObiettivi();
      const el = document.getElementById("g-" + ds.open); if (el && !t.classList.contains("goal-head")) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    else if (ds.delstep) { const { g, s } = findStep(ds.delstep); if (s) { g.step = g.step.filter(x => x !== s); changed(); renderAll(); } }
    else if (ds.addstep) {
      const g = state.data.obiettivi.find(x => x.id === ds.addstep); const inp = document.getElementById("ns-" + g.id);
      const txt = inp.value.trim(); if (!txt) { inp.focus(); return; }
      g.step.push(step(txt, document.getElementById("nm-" + g.id).value)); g.step.sort((a, b) => (a.mese || "9").localeCompare(b.mese || "9"));
      changed(); renderObiettivi(); const again = document.getElementById("ns-" + g.id); if (again) again.focus();
    }
    else if (ds.savegoal) {
      const g = state.data.obiettivi.find(x => x.id === ds.savegoal);
      g.scadenza = document.getElementById("gd-" + g.id).value; g.indicativa = document.getElementById("gi-" + g.id).value === "1";
      changed(); toast("Scadenza salvata"); renderObiettivi();
    }
    else if (ds.askdel) { state.confirmDelete = ds.askdel; renderObiettivi(); }
    else if ("canceldel" in ds) { state.confirmDelete = null; renderObiettivi(); }
    else if (ds.delgoal) { state.data.obiettivi = state.data.obiettivi.filter(x => x.id !== ds.delgoal); state.openGoal = null; state.confirmDelete = null; changed(); toast("Obiettivo eliminato"); renderObiettivi(); }
    else if ("newgoal" in ds) {
      const n = document.getElementById("ng-name").value.trim(); if (!n) { document.getElementById("ng-name").focus(); return; }
      const used = state.data.obiettivi.map(g => g.colore);
      const colore = GOAL_COLORS.find(c => !used.includes(c)) || GOAL_COLORS[state.data.obiettivi.length % GOAL_COLORS.length];
      const g = { id: uid(), nome: n, colore, scadenza: document.getElementById("ng-date").value, indicativa: true, step: [] };
      state.data.obiettivi.push(g); state.openGoal = g.id; changed(); renderObiettivi();
      const el = document.getElementById("ns-" + g.id); if (el) el.focus();
    }
  });
  document.addEventListener("change", e => {
    const t = e.target;
    if (t.dataset && t.dataset.step) toggleStep(t.dataset.step, t.checked);
  });

  document.getElementById("open-add").onclick = () => openAdd();
  document.getElementById("open-settings").onclick = openSettings;
  document.querySelectorAll("[data-close]").forEach(b => b.onclick = () => { document.getElementById(b.dataset.close).hidden = true; });
  document.querySelectorAll(".sheet-bg").forEach(bg => bg.addEventListener("click", e => { if (e.target === bg) bg.hidden = true; }));
  document.addEventListener("keydown", e => { if (e.key === "Escape") document.querySelectorAll(".sheet-bg").forEach(b => { b.hidden = true; }); });
  document.getElementById("add-confirm").onclick = confirmAdd;
  document.getElementById("set-save").onclick = saveSettings;
  ["add-date", "add-title", "add-start", "add-end"].forEach(id => document.getElementById(id).addEventListener("input", updateSummary));

  // ---------- Avvio ----------
  handleRedirect();
  state.data = readLocal() || seedData();
  if (!state.data.giorni) state.data.giorni = {};
  if (!state.data.settings.tema) state.data.settings.tema = "chiaro";
  let startView = state.view;
  try { if (startView === "oggi") startView = localStorage.getItem(LS_VIEW) || "oggi"; } catch (e) {}
  setView(startView);

  if (getToken()) { loadWeek(); syncSheet(); }
  else if (CFG.googleClientId && hadLogin()) {
    // accesso scaduto: un tentativo silenzioso per sessione, poi il pulsante
    let failed = false; try { failed = sessionStorage.getItem("agenda.silent.failed") === "1" || sessionStorage.getItem("agenda.silent.tried") === "1"; sessionStorage.setItem("agenda.silent.tried", "1"); } catch (e) { failed = true; }
    if (!failed && navigator.onLine !== false) login(true);
  }
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible" || !getToken()) return;
    if (state.fetchedAt && Date.now() - state.fetchedAt > 5 * 60000) loadWeek();
    if (!isDirty() && Date.now() - lastRead > 2 * 60000) syncSheet();
  });

  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
})();
