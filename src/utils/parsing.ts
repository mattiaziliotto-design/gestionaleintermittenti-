import { InputRow, LavoratoreRaggruppato } from '../types';
import { GIORNI, dateForGiorno, normalizeGiorno } from './dates';

const randomSuffix = () => Math.random().toString(36).substring(2, 6);

function isHeaderCf(cf: string): boolean {
  // Confronto esatto: un CF reale può contenere la sequenza "CF"
  const upper = cf.toUpperCase();
  return upper === 'CF' || upper === 'C.F.' || upper.startsWith('CODICE FISCALE') || upper.startsWith('CODICE_FISCALE');
}

// Parsing del testo incollato da Excel (colonne: CF, nominativo, giorno)
export function parsePastedData(text: string): InputRow[] {
  const rows: InputRow[] = [];

  text.split('\n').forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    let parts: string[];
    if (trimmed.includes('\t')) parts = trimmed.split('\t');
    else if (trimmed.includes(';')) parts = trimmed.split(';');
    else if (trimmed.includes(',')) parts = trimmed.split(',');
    else parts = trimmed.split(/\s{2,}/); // Due o più spazi consecutivi

    const [cf = '', nominativo = '', giorno = ''] = parts.map(p => p.trim());
    if (isHeaderCf(cf)) return;

    // Verifica basica per evitare righe vuote o spezzate
    if (cf.length > 5 && nominativo.length > 2) {
      rows.push({
        id: `paste-${index}-${randomSuffix()}`,
        codiceFiscale: cf,
        nominativo,
        giornoLavoro: giorno,
      });
    }
  });

  return rows;
}

// Converte le righe di un foglio Excel (matrice di celle) in righe di input,
// riconoscendo l'eventuale intestazione per individuare le colonne
export function parseSheetRows(jsonData: unknown[][]): InputRow[] {
  let cfIndex = 0;
  let nameIndex = 1;
  let dayIndex = 2;
  let startRow = 0;

  if (jsonData.length > 0) {
    const firstRow = Array.from(jsonData[0] ?? [], cell => String(cell ?? '').toUpperCase().trim());
    const foundCf = firstRow.findIndex(cell => cell === 'CF' || cell === 'C.F.' || cell.includes('FISCALE'));
    const foundName = firstRow.findIndex(cell => ['NOME', 'DIPENDENTE', 'NOMINATIVO', 'LAVORATORE'].some(k => cell.includes(k)));
    const foundDay = firstRow.findIndex(cell => ['GIORNO', 'LAVORO', 'SERVIZIO', 'SETTIMANA'].some(k => cell.includes(k)));

    if (foundCf !== -1) cfIndex = foundCf;
    if (foundName !== -1) nameIndex = foundName;
    if (foundDay !== -1) dayIndex = foundDay;
    if (foundCf !== -1 || foundName !== -1 || foundDay !== -1) startRow = 1; // Salta l'intestazione
  }

  const rows: InputRow[] = [];
  for (let i = startRow; i < jsonData.length; i++) {
    const rowData = jsonData[i];
    if (!rowData || rowData.length < 2) continue;

    const cf = String(rowData[cfIndex] ?? '').trim();
    const nominativo = String(rowData[nameIndex] ?? '').trim();
    const giorno = String(rowData[dayIndex] ?? '').trim();

    if (cf.length > 5 && nominativo) {
      rows.push({
        id: `excel-${i}-${randomSuffix()}`,
        codiceFiscale: cf,
        nominativo,
        giornoLavoro: giorno,
        rigaOriginale: i + 1,
      });
    }
  }
  return rows;
}

export interface RisultatoElaborazione {
  lavoratori: LavoratoreRaggruppato[];
  // Righe scartate perché il giorno non è stato riconosciuto (vuoto, data, testo libero)
  righeNonRiconosciute: InputRow[];
}

// Raggruppa le righe per codice fiscale e calcola le date nella settimana indicata.
// I lavoratori senza alcuna giornata valida non entrano nell'elenco.
export function raggruppaLavoratori(rows: InputRow[], mondayISO: string): RisultatoElaborazione {
  const groups = new Map<string, { nominativo: string; giorni: Set<string> }>();
  const righeNonRiconosciute: InputRow[] = [];

  for (const row of rows) {
    const cf = row.codiceFiscale.toUpperCase().replace(/\s+/g, '');
    if (!cf) continue;

    const giorno = normalizeGiorno(row.giornoLavoro);
    if (!giorno) {
      righeNonRiconosciute.push(row);
      continue;
    }

    let group = groups.get(cf);
    if (!group) {
      group = { nominativo: row.nominativo.trim(), giorni: new Set() };
      groups.set(cf, group);
    }
    group.giorni.add(giorno);
  }

  const lavoratori = Array.from(groups, ([codiceFiscale, group]) => ({
    codiceFiscale,
    nominativo: group.nominativo,
    // Ordine cronologico: da lunedì a domenica
    prestazioni: GIORNI.filter(g => group.giorni.has(g)).map(g => ({ giorno: g, data: dateForGiorno(mondayISO, g) })),
  }));

  return { lavoratori, righeNonRiconosciute };
}

// Riallinea le prestazioni di un lavoratore alla settimana indicata:
// sigle normalizzate, date ricalcolate, doppioni rimossi, ordine cronologico
export function riallineaPrestazioni(lav: LavoratoreRaggruppato, mondayISO: string): LavoratoreRaggruppato {
  const giorni = new Set(lav.prestazioni.map(p => normalizeGiorno(p.giorno)));
  return {
    ...lav,
    prestazioni: GIORNI.filter(g => giorni.has(g)).map(g => ({ giorno: g, data: dateForGiorno(mondayISO, g) })),
  };
}
