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

## Dati salvati

Storico delle elaborazioni, dati del datore di lavoro e sessione sono salvati nel `localStorage`
del browser di ciascun utente (chiavi `interm_*`, da non rinominare). Non sono condivisi tra
computer o browser diversi: per conservarli o trasferirli si usa "Esporta Backup JSON".

## Sicurezza

- L'accesso richiede un account Google del dominio `@bertifood.it` o presente in `VITE_ALLOWED_EMAILS`;
  la sessione dura 7 giorni.
- `vercel.json` imposta Content-Security-Policy e le altre intestazioni di sicurezza.
- Il controllo dell'accesso avviene nel browser, perché non esiste un server: limita l'uso
  dell'interfaccia ma non sostituisce una protezione lato server.

## Struttura

- `src/App.tsx`: stato dell'applicazione e pagina principale
- `src/components/`: schermata di accesso, inserimento dati, elenco lavoratori, modifica, anteprima, storico
- `src/utils/`: logica senza interfaccia (date, codice fiscale, lettura dati, intervalli, storico, accesso, PDF)
- `src/types.ts`: tipi condivisi
