// Capisce le frasi dettate ("aggiungi danza giovedì dalle 18 alle 20",
// "spesa 25 euro Esselunga", "ho pagato l'INPS", "fatto il ripasso di anatomia")
// e le trasforma in un'azione da confermare. Non salva niente: lo fa app.js
// dopo che Mary tocca Conferma.
(function (root) {
  "use strict";

  const GIORNI = ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"];
  const MESI = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
  const NUM = { "un": 1, "una": 1, "uno": 1, "due": 2, "tre": 3, "quattro": 4, "cinque": 5, "sei": 6, "sette": 7, "otto": 8, "nove": 9, "dieci": 10, "undici": 11, "dodici": 12, "tredici": 13, "quattordici": 14, "quindici": 15, "sedici": 16, "diciassette": 17, "diciotto": 18, "diciannove": 19, "venti": 20, "ventuno": 21, "ventidue": 22, "ventitré": 23, "trenta": 30, "quaranta": 40, "cinquanta": 50, "cento": 100, "mezzogiorno": 12, "mezzanotte": 0 };
  const SHIFTS = [
    { re: /\bturno spezzato\b|\b10\s*-\s*14 e 16\s*-\s*20\b/, parts: [["10:00", "14:00"], ["16:00", "20:00"]] },
    { re: /\bturno (di |della )?mattina\b/, parts: [["09:00", "15:00"]] },
    { re: /\bturno (di |del )?pomeriggio\b/, parts: [["15:00", "21:00"]] },
    { re: /\bturno centrale\b/, parts: [["12:00", "19:00"]] }
  ];
  const STOP = new Set(["il", "lo", "la", "i", "gli", "le", "l", "un", "una", "uno", "di", "del", "della", "dello", "dei", "delle", "a", "al", "alla", "allo", "ai", "da", "dal", "dalla", "in", "per", "con", "e", "che", "mi", "ho", "devo", "poi", "anche", "per favore", "favore", "ok", "allora", "quello", "quella", "evento", "appuntamento", "impegno"]);

  function pad(n) { return String(n).padStart(2, "0"); }
  function ymd(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function startOfDay(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
  function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function cap(s) { s = s.trim(); return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

  function clean(text) {
    let t = " " + String(text || "").toLowerCase()
      .replace(/[’`]/g, "'")
      .replace(/\b(lunedi|martedi|mercoledi|giovedi|venerdi)\b/g, m => m.slice(0, -1) + "ì")
      .replace(/([a-zà-ú])'(?=[a-zà-ú])/g, "$1 ")
      .replace(/[!?;]+/g, " ")
      .replace(/\s+/g, " ") + " ";
    // numeri scritti in lettere → cifre (solo parole intere)
    t = t.replace(/ (un|una|uno|due|tre|quattro|cinque|sei|sette|otto|nove|dieci|undici|dodici|tredici|quattordici|quindici|sedici|diciassette|diciotto|diciannove|venti|ventuno|ventidue|ventitré|trenta|quaranta|cinquanta|cento|mezzogiorno|mezzanotte)(?= (e|euro|€|ore|alle|del|di|meno|$)| ?[,.]| $)/g, (m, w) => {
      if ((w === "un" || w === "una" || w === "uno") ) return " " + w; // articoli: li gestiscono le regole sotto
      return " " + NUM[w];
    });
    return t;
  }

  // ---------- Date ----------
  function takeDate(t, now) {
    const today = startOfDay(now);
    let m, date = null;
    const cut = re => { t = t.replace(re, " "); };
    if ((m = t.match(/ (dopodomani|dopo domani) /))) { date = addDays(today, 2); cut(m[0]); }
    else if ((m = t.match(/ (domani) /))) { date = addDays(today, 1); cut(m[0]); }
    else if ((m = t.match(/ (oggi|stasera|stamattina|stamani|stanotte|oggi pomeriggio) /))) { date = today; cut(m[0]); }
    else if ((m = t.match(/ (ieri) /))) { date = addDays(today, -1); cut(m[0]); }
    else if ((m = t.match(/ (?:il |l |lo |per |entro |di |da |a |al )?(\d{1,2})(?: |\/|-)(\d{1,2}|gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)(?:(?: |\/|-)(\d{4}))? /))) {
      const d = Number(m[1]); const mo = isNaN(Number(m[2])) ? MESI.indexOf(m[2]) : Number(m[2]) - 1;
      if (d >= 1 && d <= 31 && mo >= 0 && mo <= 11) {
        let y = m[3] ? Number(m[3]) : today.getFullYear();
        let x = new Date(y, mo, d);
        if (!m[3] && x < addDays(today, -60)) x = new Date(y + 1, mo, d);
        date = x; cut(m[0]);
      }
    }
    if (!date && (m = t.match(/ (?:(?:per |da |a |di )?(?:il |l |lo |la |al ))?(?:prossim[oa] )?(lunedì|martedì|mercoledì|giovedì|venerdì|sabato|domenica)( prossim[oa]| della prossima settimana| che viene)? /))) {
      const wd = GIORNI.indexOf(m[1]);
      let n = (wd - today.getDay() + 7) % 7;
      const next = /prossim/.test(m[0]) || /che viene/.test(m[0]);
      if (next && n === 0) n = 7;
      else if (next) { const monNext = addDays(today, ((8 - today.getDay()) % 7) || 7); const cand = addDays(today, n); if (cand < monNext) n += 7; }
      date = addDays(today, n); cut(m[0]);
    }
    if (!date && (m = t.match(/ (?:il |l |per il |entro il )(\d{1,2}) /))) {
      const d = Number(m[1]);
      if (d >= 1 && d <= 31) { let x = new Date(today.getFullYear(), today.getMonth(), d); if (x < today) x = new Date(today.getFullYear(), today.getMonth() + 1, d); date = x; cut(m[0]); }
    }
    if (date) t = t.replace(/ (?:di |il |la )?(lunedì|martedì|mercoledì|giovedì|venerdì|sabato|domenica) /g, " ");
    return { t, date };
  }

  // ---------- Orari ----------
  function hhmm(h, min) { return pad(h) + ":" + pad(min || 0); }
  function readTime(s) {
    // "18", "18:30", "18.30", "18 e 30", "18 e mezza", "18 e un quarto", "6 meno un quarto"
    const m = s.match(/^(\d{1,2})(?:(?::|\.|,)(\d{2})| e (mezza|mezzo|un quarto|quarto|tre quarti|\d{1,2})| meno (un quarto|quarto|\d{1,2}))?$/);
    if (!m) return null;
    let h = Number(m[1]), min = 0;
    if (m[2]) min = Number(m[2]);
    else if (m[3]) min = /mezz/.test(m[3]) ? 30 : /tre quarti/.test(m[3]) ? 45 : /quarto/.test(m[3]) ? 15 : Number(m[3]);
    else if (m[4]) { const sub = /quarto/.test(m[4]) ? 15 : Number(m[4]); h -= 1; min = 60 - sub; }
    if (h > 24 || min > 59) return null;
    return { h, min };
  }
  function fixPm(tm, t, ref) {
    // "alle 3" senza "di mattina" = 15:00; "alle 9 di sera" = 21:00
    if (!tm) return tm;
    let h = tm.h;
    if (/ (di |del |della |nel )?(sera|pomeriggio|notte) /.test(t) && h < 12) h += 12;
    else if (!/ (di |del |della |la )?mattin[ao] /.test(t) && h >= 1 && h <= 7) h += 12;
    if (ref && h * 60 + tm.min <= ref.h * 60 + ref.min && h < 12) h += 12;
    return { h: h % 24, min: tm.min };
  }
  const T = "(\\d{1,2}(?:(?::|\\.)\\d{2}| e (?:mezza|mezzo|un quarto|quarto|tre quarti|\\d{1,2})| meno (?:un quarto|quarto|\\d{1,2}))?)";
  function takeTimes(t) {
    let m, a = null, b = null, dur = null, parts = null;
    for (const s of SHIFTS) if (s.re.test(t)) { parts = s.parts; t = t.replace(s.re, " turno "); break; }
    if (!parts && (m = t.match(new RegExp(" (?:dalle |dall |da )?(?:ore )?" + T + " ?(?:-|alle|all|fino alle|a) " + T + "(?= )(?: e (?:dalle |dall )?" + T + " ?(?:-|alle|all) " + T + ")? ")))) {
      const r = [[readTime(m[1]), readTime(m[2])]]; if (m[3]) r.push([readTime(m[3]), readTime(m[4])]);
      if (r.every(p => p[0] && p[1])) {
        const ctx = t;
        parts = r.map(([x, y]) => { const xa = fixPm(x, ctx); const yb = fixPm(y, ctx, xa); return [hhmm(xa.h, xa.min), hhmm(yb.h, yb.min)]; });
        t = t.replace(m[0], " ");
      }
    }
    if (!parts && (m = t.match(new RegExp(" (?:alle |all |verso le |per le |ore |a partire dalle |dalle )(?:ore )?" + T + "(?= )")))) {
      const x = readTime(m[1]); if (x) { a = fixPm(x, t); t = t.replace(m[0], " "); }
    }
    if ((m = t.match(/ per (\d{1,2}|un|una|mezz) ?(ore|ora|oretta|minuti|min)( e mezza)? /))) {
      const n = m[1] === "un" || m[1] === "una" ? 1 : m[1] === "mezz" ? 0.5 : Number(m[1]);
      dur = /min/.test(m[2]) ? n / 60 : n + (m[3] ? 0.5 : 0);
      t = t.replace(m[0], " ");
    } else if ((m = t.match(/ per (mezz'?ora|mezzora|mezza ora) /))) { dur = 0.5; t = t.replace(m[0], " "); }
    if (!parts && a) {
      const startM = a.h * 60 + a.min, endM = Math.min(startM + Math.round((dur || 1) * 60), 23 * 60 + 59);
      parts = [[hhmm(a.h, a.min), hhmm(Math.floor(endM / 60), endM % 60)]];
    }
    t = t.replace(/ (di |del |della |nel )?(mattina|sera|pomeriggio|notte) /g, " ");
    return { t, parts, start: a ? hhmm(a.h, a.min) : null };
  }

  // ---------- Soldi ----------
  function takeAmount(t) {
    const m = t.match(/ (\d{1,3}(?:\.\d{3})+|\d+)(?:(?:,|\.)(\d{1,2}))?(?: e (\d{1,2}))? ?(?:euro|€|eur)(?: e (\d{1,2})(?: centesimi)?)? /);
    if (!m) return { t, amount: null };
    const cents = m[2] || m[3] || m[4];
    const amount = Number(m[1].replace(/\./g, "")) + (cents ? Number(cents.padEnd(2, "0")) / 100 : 0);
    return { t: t.replace(m[0], " "), amount };
  }
  function moneyCat(words) {
    const x = " " + words + " ";
    if (/ (benzina|carburante|diesel|gasolio|pieno) /.test(x)) return "Benzina";
    if (/ (spesa|supermercato|esselunga|coop|conad|lidl|carrefour|eurospin|pam|iper|mercato|alimentari) /.test(x)) return "Spesa";
    if (/ (inps|iva|p iva|tasse|tassa|f24|imposta|commercialista) /.test(x)) return "Tasse";
    if (/ (rata|rate|abbonamento|affitto|bolletta|corso|finanziamento) /.test(x)) return "Rate";
    if (/ (stipendio|paga|busta paga) /.test(x)) return "Stipendio";
    return null;
  }
  function tidy(t) {
    const w = t.replace(/[.,:]/g, " ").split(/\s+/).filter(Boolean);
    while (w.length && STOP.has(w[0])) w.shift();
    while (w.length && STOP.has(w[w.length - 1])) w.pop();
    return w.join(" ");
  }
  // rimette maiuscole e nomi come li ha detti ("cena con Giulia")
  function restore(title, raw) {
    const orig = String(raw).replace(/[.,!?;:]/g, " ").split(/\s+/).filter(Boolean);
    return title.split(" ").map(w => { const o = orig.find(x => x.toLowerCase().replace(/[’']/g, "") === w); return o && /[A-Z]/.test(o.slice(1)) || (o && o !== o.toLowerCase() && orig.indexOf(o) > 0) ? o : w; }).join(" ");
  }
  function keywords(s) { return tidy(clean(s)).split(" ").filter(x => x.length > 1 && !STOP.has(x)); }

  // ---------- Frase → azione ----------
  function parseOne(text, now) {
    const raw = String(text || "").trim();
    if (!raw) return null;
    let t = clean(raw);
    let m;

    // Obiettivi: "fatto lo step ...", "ho finito ...", "completato ..."
    if ((m = t.match(/^ (?:ho )?(?:fatto|finito|completato|terminato|chiuso|spunta|segna (?:come )?fatto)(?: lo step| il passo| lo)? (.+)$/)) && !/ (euro|€) /.test(t)) {
      return { tipo: "step", cerca: tidy(m[1]), testo: raw };
    }

    // Soldi
    const pagato = /^ (?:ho |l ho |gli ho )?(?:pagato|saldato|versato) /.test(t);
    const incassato = /^ (?:ho )?(?:incassato|ricevuto|preso) | (?:è arrivato|e arrivato|arrivato|mi hanno pagato|mi è arrivato|mi e arrivato) /.test(t);
    const futuro = /^ (?:devo pagare|da pagare|scadenza|devo versare|ricordami di pagare) /.test(t);
    const futuroIn = /^ (?:devo incassare|devo ricevere|mi devono|da incassare|arriva|arriverà) /.test(t);
    const spesa = /^ (?:spesa|speso|ho speso|spese|uscita|comprato|ho comprato|acquistato|benzina|pieno|fatto benzina|ho fatto benzina|ho fatto il pieno|ho fatto la spesa|fatto la spesa) /.test(t);
    const entrata = /^ (?:entrata|entrate|guadagnato|ho guadagnato|stipendio) /.test(t);
    const am = takeAmount(t);
    if (pagato || incassato || futuro || futuroIn || spesa || entrata || (am.amount && !/ (dalle|alle) \d/.test(t))) {
      const d = takeDate(am.t, now);
      let rest = d.t.replace(/^ (?:ho |l ho |gli ho )?(?:pagato|saldato|versato|incassato|ricevuto|preso|speso|comprato|acquistato|guadagnato|devo pagare|da pagare|devo versare|ricordami di pagare|devo incassare|devo ricevere|mi devono|da incassare|scadenza|uscita|entrata|entrate) /, " ")
        .replace(/ (?:è arrivato|e arrivato|arrivato|mi hanno pagato|mi è arrivato|mi e arrivato|arriva|arriverà) /, " ")
        .replace(/^ (?:ho )?fatto (?:il pieno|la spesa|benzina) /, m0 => /pieno|benzina/.test(m0) ? " benzina " : " spesa ");
      const cosa = tidy(rest.replace(/ (?:per|di|in|al|alla|da) (?=\S)/g, " "));
      let cat = moneyCat(cosa) || (incassato || futuroIn || entrata ? "Altre entrate" : "Extra");
      const isIn = cat === "Stipendio" || cat === "Altre entrate";
      if ((pagato || incassato) && !am.amount) return { tipo: "segna", cerca: cosa, entrata: incassato, testo: raw };
      if (pagato || incassato) return { tipo: "segna", cerca: cosa, entrata: incassato, importo: am.amount, data: d.date ? ymd(d.date) : ymd(now), categoria: cat, testo: raw };
      if (!am.amount) return { tipo: "errore", motivo: "Non ho capito l'importo. Prova con \"spesa 25 euro Esselunga\".", testo: raw };
      return { tipo: "movimento", cosa: cap(restore(cosa, raw) || cat), categoria: cat, importo: am.amount, data: ymd(d.date || now), fatto: !(futuro || futuroIn) && (!d.date || d.date <= startOfDay(now)), entrata: isIn, testo: raw };
    }

    // Calendario: cancella
    if ((m = t.match(/^ (?:cancella|elimina|togli|rimuovi|annulla|disdici)(?: dal calendario)? (.*)$/))) {
      const d = takeDate(" " + m[1] + " ", now); const tm = takeTimes(d.t);
      return { tipo: "cancella", cerca: tidy(tm.t), data: d.date ? ymd(d.date) : null, ora: tm.start || (tm.parts ? tm.parts[0][0] : null), testo: raw };
    }
    // Calendario: sposta
    if ((m = t.match(/^ (?:sposta|spostare|anticipa|posticipa|rimanda|cambia orario (?:di|a|al|alla)?)(.*)$/))) {
      let body = " " + m[1] + " ";
      let from = body, to = "";
      const sp = body.match(/^(.*?) (?:a|al|alla|all|ad|per|in|verso) ((?:(?:il |l |lo |la )?(?:prossim[oa] )?(?:lunedì|martedì|mercoledì|giovedì|venerdì|sabato|domenica|domani|dopodomani|oggi|\d{1,2})|(?:le )?ore|le \d|dopo|stasera).*)$/);
      if (sp) { from = " " + sp[1] + " "; to = " " + sp[2] + " "; }
      else if ((m = body.match(/^(.*?) ((?:alle|dalle|all) .*)$/))) { from = " " + m[1] + " "; to = " " + m[2] + " "; }
      const df = takeDate(from, now); const tf = takeTimes(df.t);
      const dt = takeDate(to.replace(/^ (?:le )?ore /, " alle "), now); const tt = takeTimes(dt.t.replace(/^ (\d{1,2}(?::\d{2})?) /, " alle $1 "));
      if (!dt.date && !tt.parts) return { tipo: "errore", motivo: "Non ho capito dove spostarlo. Prova con \"sposta la psicologa a venerdì alle 17\".", testo: raw };
      return { tipo: "sposta", cerca: tidy(tf.t), data: df.date ? ymd(df.date) : null, ora: tf.start || (tf.parts ? tf.parts[0][0] : null), nuovaData: dt.date ? ymd(dt.date) : null, nuovoOrario: tt.parts ? tt.parts[0] : null, durataNuova: !!(tt.parts && / (dalle|-|fino) /.test(to)), testo: raw };
    }
    // Calendario: aggiungi
    let body = t.replace(/^ (?:aggiungi|aggiungere|metti|mettimi|segna|segnami|inserisci|crea|fissa|prenota|ricordami|nuovo|nuova)(?: in calendario| sul calendario| al calendario| un| una| l)? /, " ");
    const d = takeDate(body, now); const tm = takeTimes(d.t);
    let title = tidy(tm.t.replace(/ (?:in|sul|al) calendario /g, " "));
    const turno = / turno /.test(tm.t) || /^(turno|vibe|palestra|lavoro)( |$)/.test(title);
    if (turno && /^(turno|lavoro)( palestra| vibe)?$/.test(title)) title = "Turno palestra";
    if (!title) return { tipo: "errore", motivo: "Non ho capito cosa aggiungere. Prova con \"aggiungi danza giovedì dalle 18 alle 20\".", testo: raw };
    if (!d.date && !tm.parts) return { tipo: "errore", motivo: "Mi manca il giorno o l'orario. Prova con \"" + cap(title) + " domani alle 18\".", testo: raw };
    return { tipo: "aggiungi", titolo: cap(restore(title, raw)), data: ymd(d.date || now), parti: tm.parts || null, turno, testo: raw };
  }

  function parse(text, now) {
    now = now || new Date();
    const pieces = String(text || "").split(/(?:\.\s+|\n+|\s+e poi\s+|;\s*)/i).map(s => s.trim()).filter(Boolean);
    return pieces.map(p => parseOne(p.replace(/\.$/, ""), now)).filter(Boolean);
  }

  // Punteggio di somiglianza tra quello che ha detto e un titolo (0–1)
  function score(query, title) {
    const q = keywords(query), w = keywords(title);
    if (!q.length || !w.length) return 0;
    let hit = 0;
    for (const x of q) if (w.some(y => y === x || (x.length >= 4 && (y.startsWith(x.slice(0, 4)) || x.startsWith(y.slice(0, Math.max(4, y.length - 1))))))) hit++;
    return hit / q.length;
  }

  const api = { parse, score, keywords };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.AgendaComandi = api;
})(typeof window !== "undefined" ? window : this);
