// "Dimmi cosa fare": Mary detta una frase (microfono della tastiera dell'iPhone),
// comandi.js la capisce, qui la trasformo in un'azione da confermare.
// Usa le funzioni dell'app che app.js espone in window.AgendaApp.
(function () {
  "use strict";
  const ESEMPI = ["Aggiungi danza giovedì dalle 18 alle 20", "Sposta la psicologa a venerdì alle 17", "Cancella studio di domani", "Spesa 25 euro Esselunga", "Ho pagato l'INPS", "Fatto il ripasso di anatomia"];
  let A = null, req = 0, piano = [], timer = null;
  const $ = id => document.getElementById(id);

  function fmtD(s) { return A.fmtDay(A.parseYmd(s)).toLowerCase(); }
  function cap1(x) { x = String(x || "").trim(); return x ? x[0].toUpperCase() + x.slice(1) : x; }
  async function findEvents(dataStr) {
    const from = dataStr ? A.parseYmd(dataStr) : A.startOfDay(new Date());
    const to = A.addDays(from, dataStr ? 1 : 31);
    const p = new URLSearchParams({ timeMin: from.toISOString(), timeMax: to.toISOString(), singleEvents: "true", orderBy: "startTime", maxResults: "250", timeZone: A.TZ });
    const r = await A.gfetch("https://www.googleapis.com/calendar/v3/calendars/primary/events?" + p.toString());
    return A.normalize((await r.json()).items);
  }
  function bestMatch(list, query, getText, extra) {
    let best = null, bs = 0;
    for (const x of list) {
      const base = AgendaComandi.score(query, getText(x));
      if (base < 0.5) continue;
      const sc = base + (extra ? extra(x) : 0);
      if (!best || sc > bs + 1e-9) { best = x; bs = sc; }
    }
    return best;
  }
  function evLabel(ev) { return ev.title + ", " + A.fmtDay(ev.start).toLowerCase() + (ev.allDay ? " (tutto il giorno)" : ", " + A.hm(ev.start) + "–" + A.hm(ev.end)); }
  const CAL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
  const esc = s => A.esc(s);

  async function resolve(c) {
    const now = new Date();
    if (c.tipo === "errore") return { ok: false, txt: esc(c.motivo) };
    if (c.tipo === "aggiungi" || c.tipo === "cancella" || c.tipo === "sposta") {
      if (!A.getToken()) return { ok: false, txt: "Per usare il calendario prima accedi con Google." };
    }
    if (c.tipo === "aggiungi") {
      const quando = fmtD(c.data) + (c.parti ? ", " + c.parti.map(p => p[0] + "–" + p[1]).join(" e ") : ", tutto il giorno");
      return { ok: true, icon: "+", txt: "Aggiungo al calendario <strong>" + esc(c.titolo) + "</strong>, " + esc(quando) + ".", cal: c.data, run: async () => {
        if (c.parti) { for (const [a, b] of c.parti) await A.createEvent(c.titolo, A.parseYmd(c.data), a, b, c.turno ? "7" : null); }
        else await A.gfetch(CAL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ summary: c.titolo, start: { date: c.data }, end: { date: A.ymd(A.addDays(A.parseYmd(c.data), 1)) } }) });
        return "Aggiunto: " + c.titolo;
      } };
    }
    if (c.tipo === "cancella" || c.tipo === "sposta") {
      const list = (await findEvents(c.data)).filter(ev => c.data || ev.end > now);
      const ev = bestMatch(list, c.cerca, e => e.title + " " + A.catText(e.cat), e => AgendaComandi.score(c.cerca, e.title) * 0.3 + (c.ora && !e.allDay && A.hm(e.start) === c.ora ? 0.3 : 0));
      if (!ev) return { ok: false, txt: "Non trovo \"" + esc(c.cerca) + "\" " + (c.data ? esc(fmtD(c.data)) : "nei prossimi 30 giorni") + " sul calendario." };
      if (c.tipo === "cancella") return { ok: true, icon: "×", danger: true, txt: "Cancello dal calendario <strong>" + esc(evLabel(ev)) + "</strong>.", cal: A.ymd(ev.start), run: async () => {
        await A.gfetch(CAL + "/" + encodeURIComponent(ev.id), { method: "DELETE" });
        return "Cancellato: " + ev.title;
      } };
      const day = c.nuovaData ? A.parseYmd(c.nuovaData) : A.startOfDay(ev.start);
      let body, label;
      if (ev.allDay && !c.nuovoOrario) {
        const len = Math.max(1, A.daysBetween(ev.start, ev.end));
        body = { start: { date: A.ymd(day) }, end: { date: A.ymd(A.addDays(day, len)) } }; label = A.fmtDay(day).toLowerCase();
      } else {
        const durMin = ev.allDay ? 60 : Math.round((ev.end - ev.start) / 60000);
        const a = c.nuovoOrario ? c.nuovoOrario[0] : A.hm(ev.start);
        const s0 = new Date(day); s0.setHours(Number(a.slice(0, 2)), Number(a.slice(3)), 0, 0);
        let e0;
        if (c.nuovoOrario && c.durataNuova) { e0 = new Date(day); e0.setHours(Number(c.nuovoOrario[1].slice(0, 2)), Number(c.nuovoOrario[1].slice(3)), 0, 0); }
        else e0 = new Date(s0.getTime() + durMin * 60000);
        body = { start: { dateTime: A.localIso(s0, A.hm(s0)), timeZone: A.TZ }, end: { dateTime: A.localIso(e0, A.hm(e0)), timeZone: A.TZ } };
        label = A.fmtDay(s0).toLowerCase() + ", " + A.hm(s0) + "–" + A.hm(e0);
      }
      return { ok: true, icon: "→", txt: "Sposto <strong>" + esc(evLabel(ev)) + "</strong> a <strong>" + esc(label) + "</strong>.", cal: A.ymd(day), run: async () => {
        await A.gfetch(CAL + "/" + encodeURIComponent(ev.id), { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        return "Spostato: " + ev.title;
      } };
    }
    if (c.tipo === "movimento") {
      return { ok: true, icon: "€", txt: (c.entrata ? "Segno un'entrata" : "Segno una spesa") + " in Cash: <strong>" + esc(c.cosa) + " " + A.euro(c.importo) + "</strong> · " + esc(c.categoria) + " · " + esc(fmtD(c.data)) + (c.fatto ? "" : ", <strong>" + (c.entrata ? "da incassare" : "da pagare") + "</strong>") + ".", run: async () => {
        A.addMovimento({ data: c.data, cosa: c.cosa, categoria: c.categoria, importo: c.importo, fatto: c.fatto });
        return "Segnato: " + c.cosa + " " + A.euro(c.importo);
      } };
    }
    if (c.tipo === "segna") {
      const pend = A.allItems().filter(i => !i.fatto);
      const it = bestMatch(pend, c.cerca, i => i.cosa + " " + i.categoria, i => (i.entrata === c.entrata ? 0.05 : -0.2) - Math.abs(A.daysBetween(new Date(), A.parseYmd(i.data))) / 10000);
      if (it) return { ok: true, icon: "✓", txt: "Segno come " + (it.entrata ? "incassato" : "pagato") + " <strong>" + esc(it.cosa) + (it.importo ? " " + A.euro(it.importo) : "") + "</strong> del " + esc(A.fmtShortDay(it.data)) + ".", run: async () => { A.payItem(it.key); return null; } };
      if (c.importo) return resolve({ tipo: "movimento", cosa: cap1(c.cerca) || c.categoria, categoria: c.categoria, importo: c.importo, data: c.data, fatto: true, entrata: c.entrata });
      return { ok: false, txt: "Non trovo \"" + esc(c.cerca) + "\" tra " + (c.entrata ? "le entrate da incassare" : "i pagamenti da fare") + ". Se è una spesa nuova dimmi anche l'importo." };
    }
    if (c.tipo === "step") {
      const all = [];
      for (const g of A.data().obiettivi) for (const st of g.step) if (!st.fatto) all.push({ g, st });
      const hit = bestMatch(all, c.cerca, x => x.st.testo + " " + x.g.nome + " " + (x.g.breve || ""));
      if (!hit) return { ok: false, txt: "Non trovo uno step da fare che somigli a \"" + esc(c.cerca) + "\"." };
      return { ok: true, icon: "✓", txt: "Spunto lo step <strong>" + esc(hit.st.testo) + "</strong> di " + esc(hit.g.nome) + ".", run: async () => { A.toggleStep(hit.g.id + ":" + hit.st.id, true); return null; } };
    }
    return { ok: false, txt: "Non ho capito." };
  }

  function render(mode, list) {
    const out = $("voce-out"), btn = $("voce-ok");
    if (mode === "") { out.innerHTML = ""; btn.disabled = true; btn.textContent = "Conferma"; return; }
    if (mode === "wait") { out.innerHTML = '<p class="muted small">Sto capendo…</p>'; btn.disabled = true; return; }
    out.innerHTML = list.map(r => '<div class="vplan' + (r.ok ? (r.danger ? " danger" : "") : " no") + '"><span class="vi">' + (r.ok ? r.icon : "?") + "</span><span>" + r.txt + "</span></div>").join("");
    const n = list.filter(r => r.ok).length;
    btn.disabled = !n; btn.textContent = n > 1 ? "Conferma tutte (" + n + ")" : "Conferma";
  }
  async function update() {
    const my = ++req;
    const cmds = AgendaComandi.parse($("voce-text").value, new Date());
    if (!cmds.length) { piano = []; render(""); return; }
    render("wait");
    const res = [];
    for (const c of cmds) {
      try { res.push(await resolve(c)); }
      catch (e) { res.push({ ok: false, txt: A.isAuthError(e) ? "L'accesso a Google è scaduto: accedi di nuovo." : "Google Calendar non risponde, riprova tra poco." }); }
    }
    if (my !== req) return;
    piano = res; render("list", res);
  }
  async function confirm() {
    const btn = $("voce-ok"); btn.disabled = true; btn.textContent = "Un attimo…";
    const msgs = []; let calDay = null, err = null, done = 0;
    for (const r of piano.filter(x => x.ok)) {
      try { const m = await r.run(); done++; if (m) msgs.push(m); if (r.cal) calDay = r.cal; }
      catch (e) { err = A.isAuthError(e) ? "L'accesso a Google è scaduto: accedi di nuovo e riprova." : "Google Calendar non ha risposto" + (done ? " dopo " + done + " azioni fatte" : "") + ": controlla il calendario prima di riprovare."; break; }
    }
    if (calDay) A.afterCalendarChange(calDay);
    if (err) { $("voce-out").insertAdjacentHTML("beforeend", '<p class="notice bad">' + esc(err) + "</p>"); btn.textContent = "Conferma"; return; }
    $("voce-sheet").hidden = true;
    if (msgs.length) A.toast(msgs.join(" · "));
  }
  function open() {
    $("voce-text").value = ""; piano = []; render("");
    $("voce-esempi").innerHTML = ESEMPI.map(x => '<button class="preset" data-esempio="' + esc(x) + '">' + esc(x) + "</button>").join("");
    $("voce-sheet").hidden = false; $("voce-text").focus();
  }
  function setupMic() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const b = $("voce-mic");
    if (!SR) { b.hidden = true; return; }
    let rec = null;
    const fail = () => A.toast("Il microfono qui non va: usa quello della tastiera");
    b.onclick = () => {
      if (rec) { rec.stop(); return; }
      try {
        rec = new SR(); rec.lang = "it-IT"; rec.interimResults = true; rec.continuous = false;
        const ta = $("voce-text"); const base = ta.value.trim() ? ta.value.trim().replace(/[.]?$/, ". ") : "";
        rec.onresult = e => { let t = ""; for (const r of e.results) t += r[0].transcript; ta.value = base + t; };
        rec.onerror = ev => { if (ev && ev.error !== "no-speech" && ev.error !== "aborted") fail(); };
        rec.onend = () => { rec = null; b.classList.remove("on"); update(); };
        rec.start(); b.classList.add("on");
      } catch (e) { rec = null; b.classList.remove("on"); fail(); }
    };
  }

  window.AgendaVoce = {
    init(app) {
      A = app;
      $("open-voce").onclick = open;
      $("voce-ok").onclick = confirm;
      $("voce-text").addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(update, 500); });
      $("voce-esempi").addEventListener("click", e => { const b = e.target.closest("[data-esempio]"); if (b) { $("voce-text").value = b.dataset.esempio; update(); } });
      setupMic();
    },
    resolve: c => resolve(c)
  };
})();
