import { describe, expect, it } from 'vitest';
import { isCodiceFiscaleValido } from '../codiceFiscale';
import { dateForGiorno, getMondayISO, normalizeGiorno, parseISODateLocal } from '../dates';
import { getIntervalliLavorativi } from '../intervalli';
import { parsePastedData, parseSheetRows, raggruppaLavoratori, riallineaPrestazioni } from '../parsing';
import { generateCombinedIntermittentiPdf, generateIntermittentePdf } from '../pdfGenerator';
import { sanitizeStorico } from '../storage';

const LUNEDI = '2026-11-09';

describe('date', () => {
  it('calcola il lunedì della settimana, domenica compresa', () => {
    expect(getMondayISO(parseISODateLocal('2026-11-15'))).toBe(LUNEDI);
    expect(getMondayISO(parseISODateLocal('2026-11-09'))).toBe(LUNEDI);
    expect(getMondayISO(parseISODateLocal('2027-01-01'))).toBe('2026-12-28');
  });

  it('riconosce sigle e nomi estesi dei giorni', () => {
    expect(normalizeGiorno(' sabato ')).toBe('SAB');
    expect(normalizeGiorno('Lunedì')).toBe('LUN');
    expect(normalizeGiorno('14/11/2026')).toBeNull();
    expect(normalizeGiorno('')).toBeNull();
    expect(dateForGiorno(LUNEDI, 'DOM')).toBe('15/11/2026');
  });
});

describe('codice fiscale', () => {
  it('verifica il carattere di controllo', () => {
    expect(isCodiceFiscaleValido('RSSMRA80A01F205X')).toBe(true);
    expect(isCodiceFiscaleValido('rssmra80a01f205x')).toBe(true);
    expect(isCodiceFiscaleValido('RSSMRA80A01F205Y')).toBe(false);
    expect(isCodiceFiscaleValido('RSSMRA80A01F205')).toBe(false);
    expect(isCodiceFiscaleValido('05024410267')).toBe(true);
    expect(isCodiceFiscaleValido('05024410268')).toBe(false);
  });
});

describe('intervalli', () => {
  it('unisce i giorni consecutivi e separa gli altri', () => {
    const prestazioni = ['SAB', 'LUN', 'DOM', 'MER'].map(g => ({ giorno: g, data: dateForGiorno(LUNEDI, g) }));
    expect(getIntervalliLavorativi(prestazioni)).toEqual([
      { dataInizio: '09/11/2026', dataFine: '09/11/2026', giorni: ['LUN'] },
      { dataInizio: '11/11/2026', dataFine: '11/11/2026', giorni: ['MER'] },
      { dataInizio: '14/11/2026', dataFine: '15/11/2026', giorni: ['SAB', 'DOM'] },
    ]);
  });

  it('ignora le date ripetute', () => {
    const lun = { giorno: 'LUN', data: '09/11/2026' };
    expect(getIntervalliLavorativi([lun, lun, { giorno: 'MAR', data: '10/11/2026' }])).toEqual([
      { dataInizio: '09/11/2026', dataFine: '10/11/2026', giorni: ['LUN', 'MAR'] },
    ]);
  });

  it('gestisce il cambio di mese e il cambio d\'ora', () => {
    const fineMese = [{ giorno: 'SAB', data: '31/10/2026' }, { giorno: 'DOM', data: '01/11/2026' }];
    expect(getIntervalliLavorativi(fineMese)).toHaveLength(1);
    const cambioOra = [{ giorno: 'SAB', data: '24/10/2026' }, { giorno: 'DOM', data: '25/10/2026' }, { giorno: 'LUN', data: '26/10/2026' }];
    expect(getIntervalliLavorativi(cambioOra)).toHaveLength(1);
  });
});

describe('lettura dei dati', () => {
  it('legge il testo incollato saltando intestazione e righe vuote', () => {
    const rows = parsePastedData('CODICE FISCALE\tNOME\tGIORNO\r\nRSSMRA80A01F205X\tMARIO ROSSI\tSAB\r\n\r\nRSSMRA80A01F205X\tMARIO ROSSI\tDOM\n');
    expect(rows.map(r => [r.codiceFiscale, r.nominativo, r.giornoLavoro])).toEqual([
      ['RSSMRA80A01F205X', 'MARIO ROSSI', 'SAB'],
      ['RSSMRA80A01F205X', 'MARIO ROSSI', 'DOM'],
    ]);
  });

  it('riconosce le colonne del foglio Excel dall\'intestazione', () => {
    const rows = parseSheetRows([
      ['Giorno', 'Dipendente', 'Codice Fiscale'],
      ['SAB', 'MARIO ROSSI', 'RSSMRA80A01F205X'],
      [],
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ codiceFiscale: 'RSSMRA80A01F205X', nominativo: 'MARIO ROSSI', giornoLavoro: 'SAB', rigaOriginale: 2 });
  });

  it('raggruppa per codice fiscale, senza doppioni né lavoratori privi di giornate', () => {
    const rows = [
      { id: '1', codiceFiscale: 'rssmra80a01f205x', nominativo: 'MARIO ROSSI', giornoLavoro: 'domenica' },
      { id: '2', codiceFiscale: 'RSSMRA80A01F205X', nominativo: 'MARIO ROSSI', giornoLavoro: 'SAB' },
      { id: '3', codiceFiscale: 'RSSMRA80A01F205X', nominativo: 'MARIO ROSSI', giornoLavoro: 'SAB' },
      { id: '4', codiceFiscale: 'BNCLRA85B41F205Y', nominativo: 'LAURA BIANCHI', giornoLavoro: '' },
    ];
    const { lavoratori, righeNonRiconosciute } = raggruppaLavoratori(rows, LUNEDI);
    expect(lavoratori).toEqual([
      {
        codiceFiscale: 'RSSMRA80A01F205X',
        nominativo: 'MARIO ROSSI',
        prestazioni: [{ giorno: 'SAB', data: '14/11/2026' }, { giorno: 'DOM', data: '15/11/2026' }],
      },
    ]);
    expect(righeNonRiconosciute.map(r => r.id)).toEqual(['4']);
  });

  it('riallinea le prestazioni a una nuova settimana', () => {
    const lav = { codiceFiscale: 'X', nominativo: 'Y', prestazioni: [{ giorno: 'SABATO', data: '14/11/2026' }, { giorno: 'LUN', data: '09/11/2026' }] };
    expect(riallineaPrestazioni(lav, '2026-11-16').prestazioni).toEqual([
      { giorno: 'LUN', data: '16/11/2026' },
      { giorno: 'SAB', data: '21/11/2026' },
    ]);
  });
});

describe('storico', () => {
  const voce = {
    id: 'elab-1',
    titolo: 'Settimana',
    createdAt: '2026-11-10T10:00:00.000Z',
    selectedDate: LUNEDI,
    employer: { codiceFiscale: '05024410267', email: 'a@b.it' },
    rawRows: [],
    lavoratoriElaborati: [{ codiceFiscale: 'X', nominativo: 'Y', prestazioni: [{ giorno: 'SAB', data: '14/11/2026' }] }],
    inputMethod: 'upload',
    pastedText: '',
  };

  it('lascia invariata una voce completa', () => {
    expect(sanitizeStorico([voce])).toEqual([voce]);
  });

  it('completa i campi mancanti di un backup parziale', () => {
    const [result] = sanitizeStorico([{ id: 'a', titolo: 'b', lavoratoriElaborati: [] }])!;
    expect(result.employer.codiceFiscale).toBeTruthy();
    expect(result.selectedDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result.rawRows).toEqual([]);
    expect(result.inputMethod).toBe('paste');
  });

  it('rifiuta i file che non sono un backup', () => {
    expect(sanitizeStorico({})).toBeNull();
    expect(sanitizeStorico([voce, { foo: 1 }])).toBeNull();
    expect(sanitizeStorico([voce, null])).toBeNull();
  });

  it('in modalità tollerante recupera le voci valide', () => {
    expect(sanitizeStorico([voce, { foo: 1 }, { lavoratoriElaborati: [] }], false)).toHaveLength(2);
  });
});

describe('PDF', () => {
  const employer = { codiceFiscale: '05024410267', email: 'a@b.it' };
  const prestazioni = [{ giorno: 'SAB', data: '14/11/2026' }];

  it('genera il modulo anche con nomi fuori dall\'alfabeto occidentale', async () => {
    for (const nominativo of ['MARIO ROSSI', 'ŞTEFAN POPESCU', 'Łukasz Kowalski', 'IVAN ПЕТРОВ', 'José Müller']) {
      const bytes = await generateIntermittentePdf(employer, { codiceFiscale: 'RSSMRA80A01F205X', nominativo, prestazioni });
      expect(bytes.length).toBeGreaterThan(1000);
    }
  });

  it('crea una pagina per lavoratore nel PDF unico', async () => {
    const { PDFDocument } = await import('pdf-lib');
    const lavoratori = ['A', 'B', 'C'].map(n => ({ codiceFiscale: n, nominativo: n, prestazioni }));
    const doc = await PDFDocument.load(await generateCombinedIntermittentiPdf(employer, lavoratori));
    expect(doc.getPageCount()).toBe(3);
  });
});
