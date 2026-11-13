# Guida: come mettere online l'Agenda di Mary

Sono tre passi da fare una volta sola, in tutto circa 20 minuti. Fai i primi due dal computer.

## Passo 1. Pubblicare l'app (GitHub Pages, gratis)

1. Apri https://github.com/mariannadevito5-netizen/programma
2. Vai su **Settings**, scorri fino in fondo a **Danger Zone**, poi **Change visibility** e **Make public**.
   Nel repository c'è solo il codice: obiettivi, priorità ed eventi restano nel tuo Google Drive e nel tuo Google Calendar.
3. Sempre in **Settings**, apri **Pages** nel menu a sinistra.
   - Source: **Deploy from a branch**
   - Branch: il ramo dell'app (oggi `claude/project-thread-0x3y8g`) e la cartella **/docs**
   - Premi **Save**
4. Dopo uno o due minuti l'app è online qui: https://mariannadevito5-netizen.github.io/programma/

Senza il passo 2 l'app funziona già: obiettivi e priorità si salvano sul dispositivo, ma non vedi il calendario.

## Passo 2. Collegare Google Calendar e Google Fogli

Google chiede a ogni app che legge il calendario di avere un suo "accesso". Lo crei tu, così resta solo tuo.

1. Apri https://console.cloud.google.com ed entra con il tuo account Google (quello del calendario).
2. In alto, accanto al logo, apri il menu dei progetti e scegli **Nuovo progetto**. Nome: `Agenda Mary`. Crea e selezionalo.
3. Nel menu a sinistra: **API e servizi**, poi **Libreria**. Cerca e attiva una alla volta:
   - **Google Calendar API**
   - **Google Drive API**
   - **Google Sheets API**
4. Nel menu: **Google Auth Platform** (in alcune versioni si chiama **Schermata consenso OAuth**). Premi **Inizia** e compila:
   - Nome app: `Agenda di Mary`
   - Email di assistenza: la tua
   - Pubblico: **Esterno**
   - Dati di contatto: la tua email
5. Apri **Pubblico** (o **Utenti di test**) e aggiungi la tua email Gmail come utente di test.
6. Apri **Accesso ai dati** (o **Ambiti**), premi **Aggiungi o rimuovi ambiti** e incolla questi due, uno per riga:
   ```
   https://www.googleapis.com/auth/calendar.events
   https://www.googleapis.com/auth/drive.file
   ```
   Salva.
7. Apri **Client**, poi **Crea client**:
   - Tipo di applicazione: **Applicazione web**
   - Nome: `Agenda telefono`
   - Origini JavaScript autorizzate: `https://mariannadevito5-netizen.github.io`
   - URI di reindirizzamento autorizzati: `https://mariannadevito5-netizen.github.io/programma/`
   - Premi **Crea**
8. Copia l'**ID client** (finisce con `.apps.googleusercontent.com`) e mandamelo in chat. Non è una password, si può condividere. Lo inserisco io nell'app.

Al primo accesso Google mostra l'avviso "Google non ha verificato questa app". È normale per un'app personale: tocca **Avanzate** e poi **Vai ad Agenda di Mary**.

## Passo 3. Installare l'app sul telefono

- **iPhone:** apri il link in **Safari**, tocca il pulsante Condividi (il quadrato con la freccia) e scegli **Aggiungi alla schermata Home**.
- **Android:** apri il link in **Chrome**, tocca il menu ⋮ e scegli **Installa app** (o **Aggiungi a schermata Home**).

Poi apri l'app dall'icona e tocca **Accedi con Google**.

## Cose da sapere

- L'accesso a Google dura circa un'ora. Quando riapri l'app dopo, ti fa rientrare in automatico o con un tocco.
- Obiettivi, step, priorità e impostazioni sono salvati nel Foglio Google **Agenda di Mary**, che l'app crea nel tuo Drive al primo accesso (pochi KB). Lo puoi aprire dal computer e Claude può leggerlo nei check-in per vedere a che punto sei. In alto vedi "Salvato sul Foglio Google" quando è tutto a posto.
- **Cash:** i pagamenti con l'importo nel titolo del calendario (es. "Pagamento INPS 180 €") compaiono da soli in Oggi (scaduti, oggi e prossimi 2 giorni) e nella scheda Cash. Finiscono nella scheda **Movimenti** del Foglio insieme alle spese che segni a mano, e la scheda **Resoconto** mostra mese per mese entrate e uscite per categoria. Se cambi una riga in Movimenti (per esempio Fatto da No a Sì), l'app la legge quando tocchi ↻. Questa sostituisce il vecchio file "Entrate e uscite 2026-2027".
- **Priorità (in Oggi):** nessun numero fisso, ne aggiungi quante vuoi e non si azzerano ogni giorno. Quello che non spunti resta in lista, quello che spunti sparisce quando aggiorni (↻ o riaprendo l'app). Si salvano nella scheda **Da fare** del Foglio. A voce: "Aggiungi alle priorità chiamare il commercialista", "Fatto chiamare il commercialista".
- **Dimmi cosa fare (microfono viola in alto):** tocca il microfono della tastiera dell'iPhone e detta, per esempio "Aggiungi danza giovedì dalle 18 alle 20", "Sposta la psicologa a venerdì alle 17", "Cancella studio di domani", "Spesa 25 euro Esselunga", "Ho pagato l'INPS", "Fatto il ripasso di anatomia". Puoi dire più cose separate da un punto. L'app mostra cosa ha capito e salva solo quando tocchi Conferma.
- Se modifichi il Foglio a mano, l'app legge le modifiche quando la riapri. Per aggiungere uno step basta una riga nuova con lo stesso "ID obiettivo" e la colonna "ID step" vuota.
- Gli eventi restano su Google Calendar: quello che aggiungi dall'app lo vedi anche lì, e viceversa.
