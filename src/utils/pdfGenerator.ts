import { PDFDocument, PDFFont, PDFPage, rgb, StandardFonts } from 'pdf-lib';
import { EmployerConfig, LavoratoreRaggruppato } from '../types';
import { getIntervalliLavorativi } from './intervalli';

const A4: [number, number] = [595.27, 841.89];
const RIGHE_PER_PAGINA = 10;

const NERO = rgb(0, 0, 0);
const BIANCO = rgb(1, 1, 1);
const CELESTE = rgb(0.58, 0.76, 0.96);
const BORDO_GRIGIO = rgb(0.7, 0.7, 0.7);
const GRIGIO_PULSANTE = rgb(0.82, 0.82, 0.82);
const GRIGIO_NOTA = rgb(0.5, 0.5, 0.5);

// Lettere senza scomposizione Unicode, riportate alla lettera base
const TRASLITTERAZIONI: Record<string, string> = {
  Ł: 'L', ł: 'l', Đ: 'D', đ: 'd', ı: 'i', İ: 'I', Ħ: 'H', ħ: 'h', Ŧ: 'T', ŧ: 't', ĸ: 'k', Ŋ: 'N', ŋ: 'n',
};

interface Fonts {
  regular: PDFFont;
  bold: PDFFont;
}

// I font standard del PDF coprono solo l'alfabeto occidentale (WinAnsi): i caratteri non disponibili
// vengono ricondotti alla lettera base (Ş -> S, Ł -> L) o, se impossibile, sostituiti con "?".
// Senza questa conversione la generazione dell'intero documento andrebbe in errore.
function testoStampabile(text: string, font: PDFFont): string {
  const supportati = new Set(font.getCharacterSet());
  let out = '';
  for (const char of text.replace(/\s+/g, ' ')) {
    if (supportati.has(char.codePointAt(0)!)) {
      out += char;
      continue;
    }
    const base = TRASLITTERAZIONI[char] ?? char.normalize('NFD').replace(/[̀-ͯ]/g, '');
    out += base !== '' && [...base].every(c => supportati.has(c.codePointAt(0)!)) ? base : '?';
  }
  return out;
}

function drawCampo(page: PDFPage, x: number, y: number, width: number, height = 20) {
  page.drawRectangle({ x, y, width, height, color: BIANCO, borderColor: BORDO_GRIGIO, borderWidth: 1 });
}

function drawTestoCentrato(page: PDFPage, text: string, font: PDFFont, size: number, y: number, x = 0, larghezza = A4[0]) {
  const w = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: x + (larghezza - w) / 2, y, size, font, color: NERO });
  return w;
}

function drawFascia(page: PDFPage, text: string, font: PDFFont, size: number, y: number) {
  page.drawRectangle({ x: 45, y, width: 505, height: 26, color: CELESTE, borderColor: NERO, borderWidth: 0.75 });
  drawTestoCentrato(page, text, font, size, y + 8);
}

function drawPulsante(page: PDFPage, text: string, font: PDFFont, x: number, width: number) {
  page.drawRectangle({ x, y: 180, width, height: 24, color: GRIGIO_PULSANTE, borderColor: NERO, borderWidth: 1 });
  drawTestoCentrato(page, text, font, 9, 188, x, width);
}

// Disegna i moduli di un lavoratore: una pagina ogni 10 intervalli (sempre almeno una)
function drawModuli(pdfDoc: PDFDocument, fonts: Fonts, employer: EmployerConfig, lavoratore: LavoratoreRaggruppato) {
  const { regular, bold } = fonts;
  const intervalli = getIntervalliLavorativi(lavoratore.prestazioni);
  const codiceFiscale = testoStampabile(lavoratore.codiceFiscale.toUpperCase(), regular);
  const numPagine = Math.max(1, Math.ceil(intervalli.length / RIGHE_PER_PAGINA));

  for (let pagina = 0; pagina < numPagine; pagina++) {
    const page = pdfDoc.addPage(A4);
    const width = A4[0];

    // --- TITOLO ---
    [['Comunicazione Obbligatoria', 780], ['Intermittenti', 752]].forEach(([titolo, y]) => {
      const w = drawTestoCentrato(page, titolo as string, bold, 20, y as number);
      page.drawLine({
        start: { x: (width - w) / 2, y: (y as number) - 5 },
        end: { x: (width + w) / 2, y: (y as number) - 5 },
        thickness: 1.5,
        color: NERO,
      });
    });

    // --- SEZIONE 1: DATORE DI LAVORO ---
    drawFascia(page, 'Datore di Lavoro', bold, 12, 695);

    page.drawText('codice fiscale *', { x: 45, y: 663, size: 9, font: regular, color: NERO });
    drawCampo(page, 115, 657, 140);
    page.drawText(testoStampabile(employer.codiceFiscale || '', regular), { x: 122, y: 663, size: 9.5, font: regular, color: NERO });

    page.drawText('e-mail *', { x: 275, y: 663, size: 9, font: regular, color: NERO });
    drawCampo(page, 315, 657, 235);
    page.drawText(testoStampabile(employer.email || '', regular), { x: 322, y: 663, size: 9.5, font: regular, color: NERO });

    // --- SEZIONE 2: ELENCO LAVORATORI ---
    drawFascia(page, 'Elenco lavoratori - prestazioni lavorative', bold, 11, 605);

    page.drawText('Codice Fiscale lavoratore', { x: 58, y: 585, size: 8.5, font: regular, color: NERO });
    page.drawText('Codice comunicazione', { x: 198, y: 585, size: 8.5, font: regular, color: NERO });
    page.drawText('Data inizio', { x: 348, y: 585, size: 8.5, font: regular, color: NERO });
    page.drawText('Data fine', { x: 468, y: 585, size: 8.5, font: regular, color: NERO });

    for (let i = 0; i < RIGHE_PER_PAGINA; i++) {
      const y = 555 - i * 24;
      drawCampo(page, 45, y, 130); // Codice Fiscale lavoratore
      drawCampo(page, 180, y, 130); // Codice comunicazione (vuoto nel modello)
      drawCampo(page, 315, y, 110); // Data inizio
      drawCampo(page, 430, y, 120); // Data fine

      const intervallo = intervalli[pagina * RIGHE_PER_PAGINA + i];
      if (intervallo) {
        page.drawText(codiceFiscale, { x: 50, y: y + 5.5, size: 8.5, font: regular, color: NERO });
        page.drawText(intervallo.dataInizio, { x: 340, y: y + 5.5, size: 8.5, font: regular, color: NERO });
        page.drawText(intervallo.dataFine, { x: 455, y: y + 5.5, size: 8.5, font: regular, color: NERO });
      }
    }

    // --- ANNULLAMENTO ---
    page.drawText('Annullamento', { x: 45, y: 280, size: 9, font: bold, color: NERO });
    page.drawRectangle({ x: 125, y: 278, width: 11, height: 11, color: BIANCO, borderColor: NERO, borderWidth: 1 });
    page.drawText("Selezionare la casella per effettuare l'ANNULLAMENTO delle prestazioni sopraindicate.", {
      x: 145, y: 280, size: 8, font: regular, color: NERO,
    });

    page.drawText('I campi contrassegnati con * sono obbligatori.', { x: 45, y: 250, size: 8.5, font: regular, color: NERO });

    // --- PULSANTI ESTETICI ---
    drawPulsante(page, 'Genera XML e invia via email', regular, 45, 200);
    drawPulsante(page, 'Stampa', regular, 255, 110);

    // Riferimento di cortesia a fondo pagina
    const nota = `Firma del lavoratore: ${lavoratore.nominativo} • Generato tramite Compilatore Intermittenti`;
    page.drawText(testoStampabile(nota, regular), { x: 45, y: 50, size: 7.5, font: regular, color: GRIGIO_NOTA });
  }
}

// Genera un unico PDF con i moduli di tutti i lavoratori indicati
export async function generateCombinedIntermittentiPdf(
  employer: EmployerConfig,
  lavoratori: LavoratoreRaggruppato[]
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const fonts: Fonts = {
    regular: await pdfDoc.embedFont(StandardFonts.Helvetica),
    bold: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
  };
  for (const lavoratore of lavoratori) {
    drawModuli(pdfDoc, fonts, employer, lavoratore);
  }
  return pdfDoc.save();
}

// Genera il PDF del modulo di un singolo lavoratore
export function generateIntermittentePdf(employer: EmployerConfig, lavoratore: LavoratoreRaggruppato): Promise<Uint8Array> {
  return generateCombinedIntermittentiPdf(employer, [lavoratore]);
}
