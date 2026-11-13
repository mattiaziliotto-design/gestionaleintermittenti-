# Compilatore Comunicazioni Intermittenti

Compila automaticamente il modello "Comunicazione Obbligatoria Intermittenti" in PDF,
a partire da un elenco di lavoratori (copia-incolla da Excel o file .xlsx/.xls/.csv).

L'applicazione funziona interamente nel browser: non ha un server né un database.

## Avvio in locale

**Prerequisiti:** Node.js

1. Installa le dipendenze: `npm install`
2. Copia `.env.example` in `.env.local` e compila:
   - `VITE_GOOGLE_CLIENT_ID`: Client ID OAuth di Google
   - `VITE_ALLOWED_EMAILS`: email autorizzate oltre al dominio `@bertifood.it`, separate da virgola
3. Avvia: `npm run dev`

## Comandi

- `npm run lint`: controllo dei tipi
- `npm test`: test automatici della logica (date, lettura dati, storico, PDF)
- `npm run build`: build di produzione
- `npm run preview`: serve la build con le stesse intestazioni di sicurezza di produzione

## Modulo PDF

I PDF sono compilati sul modello ministeriale UNI-Intermittente (ML-15-01), conservato in
`src/assets/modello-uni-intermittente.pdf`: l'app ne riempie i campi (datore di lavoro e fino a
10 righe per modulo) lasciandoli modificabili. Se il Ministero pubblica una nuova versione del
modello basta sostituire quel file, purché i nomi dei campi restino gli stessi.

Ogni lavoratore ha il proprio modulo, con una riga per ciascun periodo di giorni consecutivi:

- **PDF unico**: un solo file con un modulo (pagina) per lavoratore.
- **ZIP**: un file PDF separato per ciascun lavoratore.

## Dati salvati

Storico delle elaborazioni, dati del datore di lavoro e sessione sono salvati nel `localStorage`
del browser di ciascun utente (chiavi `interm_*`, da non rinominare). Non sono condivisi tra
computer o browser diversi: per conservarli o trasferirli si usa "Esporta Backup JSON".

## Sicurezza

- L'accesso richiede un account Google del dominio `@bertifood.it` o presente in `VITE_ALLOWED_EMAILS`;
  la sessione dura 12 ore.
- `vercel.json` imposta Content-Security-Policy e le altre intestazioni di sicurezza.
- Il controllo dell'accesso avviene nel browser, perché non esiste un server: limita l'uso
  dell'interfaccia ma non sostituisce una protezione lato server.

## Struttura

- `src/App.tsx`: stato dell'applicazione e pagina principale
- `src/components/`: schermata di accesso, inserimento dati, elenco lavoratori, modifica, anteprima, storico
- `src/utils/`: logica senza interfaccia (date, codice fiscale, lettura dati, intervalli, storico, accesso, PDF)
- `src/assets/`: modello ministeriale in PDF
- `src/types.ts`: tipi condivisi
