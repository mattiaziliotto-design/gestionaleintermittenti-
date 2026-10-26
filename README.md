# Compilatore Comunicazioni Intermittenti

Compila automaticamente il modello ministeriale "Comunicazione Obbligatoria Intermittenti" in PDF,
a partire da un elenco di lavoratori (copia-incolla da Excel o file .xlsx/.csv).

## Avvio in locale

**Prerequisiti:** Node.js

1. Installa le dipendenze: `npm install`
2. Copia `.env.example` in `.env.local` e compila:
   - `VITE_GOOGLE_CLIENT_ID`: Client ID OAuth di Google
   - `VITE_ALLOWED_EMAILS`: email autorizzate oltre al dominio `@bertifood.it`, separate da virgola
3. Avvia: `npm run dev`

## Struttura

- `src/App.tsx`: interfaccia e logica di elaborazione
- `src/utils/pdfGenerator.ts`: generazione del PDF del modello
- `src/types.ts`: tipi condivisi
