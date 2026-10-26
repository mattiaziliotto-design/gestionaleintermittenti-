import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { EmployerConfig, LavoratoreRaggruppato } from '../types';

export interface IntervalloLavorativo {
  dataInizio: string; // "DD/MM/YYYY"
  dataFine: string; // "DD/MM/YYYY"
  giorni: string[]; // es. ["SAB", "DOM", "LUN"]
}

export function parseDateIT(dStr: string): Date {
  const parts = dStr.split('/');
  return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
}

export function getIntervalliLavorativi(prestazioni: { giorno: string; data: string }[]): IntervalloLavorativo[] {
  if (prestazioni.length === 0) return [];

  // Ordiniamo le prestazioni per data reale
  const prestOrdinate = [...prestazioni].sort((a, b) => {
    return parseDateIT(a.data).getTime() - parseDateIT(b.data).getTime();
  });

  const intervalli: IntervalloLavorativo[] = [];
  
  let currentStart = prestOrdinate[0];
  let currentEnd = prestOrdinate[0];
  let currentGiorni = [prestOrdinate[0].giorno];

  for (let i = 1; i < prestOrdinate.length; i++) {
    const prest = prestOrdinate[i];
    const dataCorrente = parseDateIT(prest.data);
    const dataUltimaInCorso = parseDateIT(currentEnd.data);

    // Calcoliamo la differenza in millisecondi, arrotondata in giorni
    const diffTime = Math.abs(dataCorrente.getTime() - dataUltimaInCorso.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      // È consecutiva! Estendiamo l'intervallo corrente
      currentEnd = prest;
      // Se non contiene già il giorno, lo aggiunge
      if (!currentGiorni.includes(prest.giorno)) {
        currentGiorni.push(prest.giorno);
      }
    } else {
      // Non è consecutiva, salviamo l'intervallo precedente e ne iniziamo uno nuovo
      intervalli.push({
        dataInizio: currentStart.data,
        dataFine: currentEnd.data,
        giorni: currentGiorni
      });
      currentStart = prest;
      currentEnd = prest;
      currentGiorni = [prest.giorno];
    }
  }

  // Aggiungi l'ultimo intervallo
  intervalli.push({
    dataInizio: currentStart.data,
    dataFine: currentEnd.data,
    giorni: currentGiorni
  });

  return intervalli;
}

// Disegna un rettangolo con bordi neri/grigi e testo allineato al centro o sinistra
// Simulando perfettamente i campi di input del ministero
export async function generateIntermittentePdf(
  employer: EmployerConfig,
  lavoratore: LavoratoreRaggruppato
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  
  // Crea pagina A4 (595.27 x 841.89)
  const page = pdfDoc.addPage([595.27, 841.89]);
  const { width, height } = page.getSize();
  
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  
  // Colori principali
  const colorCeleste = rgb(0.58, 0.76, 0.96); // Celeste dell'immagine
  const colorBordoGrigio = rgb(0.7, 0.7, 0.7); // Bordo dei campi di input
  const colorNero = rgb(0, 0, 0);
  const colorGrigioPulsante = rgb(0.82, 0.82, 0.82);
  
  // --- TITOLO IN ALTO ---
  const titolo1 = "Comunicazione Obbligatoria";
  const titolo2 = "Intermittenti";
  
  const w1 = fontBold.widthOfTextAtSize(titolo1, 20);
  page.drawText(titolo1, {
    x: (width - w1) / 2,
    y: 780,
    size: 20,
    font: fontBold,
    color: colorNero,
  });
  // Linea sottolineatura titolo 1
  page.drawLine({
    start: { x: (width - w1) / 2, y: 775 },
    end: { x: (width - w1) / 2 + w1, y: 775 },
    thickness: 1.5,
    color: colorNero,
  });
  
  const w2 = fontBold.widthOfTextAtSize(titolo2, 20);
  page.drawText(titolo2, {
    x: (width - w2) / 2,
    y: 752,
    size: 20,
    font: fontBold,
    color: colorNero,
  });
  // Linea sottolineatura titolo 2
  page.drawLine({
    start: { x: (width - w2) / 2, y: 747 },
    end: { x: (width - w2) / 2 + w2, y: 747 },
    thickness: 1.5,
    color: colorNero,
  });
  
  // --- SEZIONE 1: DATORE DI LAVORO ---
  // Box celeste
  page.drawRectangle({
    x: 45,
    y: 695,
    width: 505,
    height: 26,
    color: colorCeleste,
    borderColor: colorNero,
    borderWidth: 0.75,
  });
  
  const txtDatore = "Datore di Lavoro";
  const wDatore = fontBold.widthOfTextAtSize(txtDatore, 12);
  page.drawText(txtDatore, {
    x: (width - wDatore) / 2,
    y: 703,
    size: 12,
    font: fontBold,
    color: colorNero,
  });
  
  // codice fiscale *
  page.drawText("codice fiscale *", {
    x: 45,
    y: 663,
    size: 9,
    font: fontRegular,
    color: colorNero,
  });
  
  // Campo input Codice Fiscale Datore
  page.drawRectangle({
    x: 115,
    y: 657,
    width: 140,
    height: 20,
    color: rgb(1, 1, 1),
    borderColor: colorBordoGrigio,
    borderWidth: 1,
  });
  
  page.drawText(employer.codiceFiscale || '', {
    x: 122,
    y: 663,
    size: 9.5,
    font: fontRegular,
    color: colorNero,
  });
  
  // e-mail *
  page.drawText("e-mail *", {
    x: 275,
    y: 663,
    size: 9,
    font: fontRegular,
    color: colorNero,
  });
  
  // Campo input Email Datore
  page.drawRectangle({
    x: 315,
    y: 657,
    width: 235,
    height: 20,
    color: rgb(1, 1, 1),
    borderColor: colorBordoGrigio,
    borderWidth: 1,
  });
  
  page.drawText(employer.email || '', {
    x: 322,
    y: 663,
    size: 9.5,
    font: fontRegular,
    color: colorNero,
  });
  
  // --- SEZIONE 2: ELENCO LAVORATORI ---
  // Box celeste
  page.drawRectangle({
    x: 45,
    y: 605,
    width: 505,
    height: 26,
    color: colorCeleste,
    borderColor: colorNero,
    borderWidth: 0.75,
  });
  
  const txtLavoratori = "Elenco lavoratori - prestazioni lavorative";
  const wLavoratori = fontBold.widthOfTextAtSize(txtLavoratori, 11);
  page.drawText(txtLavoratori, {
    x: (width - wLavoratori) / 2,
    y: 613,
    size: 11,
    font: fontBold,
    color: colorNero,
  });
  
  // Intestazioni colonne tabella
  page.drawText("Codice Fiscale lavoratore", { x: 58, y: 585, size: 8.5, font: fontRegular, color: colorNero });
  page.drawText("Codice comunicazione", { x: 198, y: 585, size: 8.5, font: fontRegular, color: colorNero });
  page.drawText("Data inizio", { x: 348, y: 585, size: 8.5, font: fontRegular, color: colorNero });
  page.drawText("Data fine", { x: 468, y: 585, size: 8.5, font: fontRegular, color: colorNero });
  
  // Righe della tabella (10 righe)
  const rigaH = 20;
  const spazioRime = 4;
  const inizioY = 555;
  
  const intervalli = getIntervalliLavorativi(lavoratore.prestazioni);
  
  for (let i = 0; i < 10; i++) {
    const currentY = inizioY - (i * (rigaH + spazioRime));
    
    // Disegna le 4 celle della riga
    // Cella 1: Codice Fiscale Lavoratore
    page.drawRectangle({
      x: 45,
      y: currentY,
      width: 130,
      height: rigaH,
      color: rgb(1, 1, 1),
      borderColor: colorBordoGrigio,
      borderWidth: 1,
    });
    
    // Cella 2: Codice Comunicazione (vuoto nel modello)
    page.drawRectangle({
      x: 180,
      y: currentY,
      width: 130,
      height: rigaH,
      color: rgb(1, 1, 1),
      borderColor: colorBordoGrigio,
      borderWidth: 1,
    });
    
    // Cella 3: Data inizio
    page.drawRectangle({
      x: 315,
      y: currentY,
      width: 110,
      height: rigaH,
      color: rgb(1, 1, 1),
      borderColor: colorBordoGrigio,
      borderWidth: 1,
    });
    
    // Cella 4: Data fine
    page.drawRectangle({
      x: 430,
      y: currentY,
      width: 120,
      height: rigaH,
      color: rgb(1, 1, 1),
      borderColor: colorBordoGrigio,
      borderWidth: 1,
    });
    
    // Se c'è una prestazione per questa riga, compiliamo le celle
    if (i < intervalli.length) {
      const intervallo = intervalli[i];
      
      // Scrivi Codice Fiscale Lavoratore
      page.drawText(lavoratore.codiceFiscale.toUpperCase(), {
        x: 50,
        y: currentY + 5.5,
        size: 8.5,
        font: fontRegular,
        color: colorNero,
      });
      
      // Scrivi Data inizio
      page.drawText(intervallo.dataInizio, {
        x: 340,
        y: currentY + 5.5,
        size: 8.5,
        font: fontRegular,
        color: colorNero,
      });
      
      // Scrivi Data fine
      page.drawText(intervallo.dataFine, {
        x: 455,
        y: currentY + 5.5,
        size: 8.5,
        font: fontRegular,
        color: colorNero,
      });
    }
  }
  
  // --- ANNULLAMENTO ---
  const annullamentoY = 280;
  page.drawText("Annullamento", {
    x: 45,
    y: annullamentoY,
    size: 9,
    font: fontBold,
    color: colorNero,
  });
  
  // Casella checkbox annullamento
  page.drawRectangle({
    x: 125,
    y: annullamentoY - 2,
    width: 11,
    height: 11,
    color: rgb(1, 1, 1),
    borderColor: colorNero,
    borderWidth: 1,
  });
  
  page.drawText("Selezionare la casella per effettuare l'ANNULLAMENTO delle prestazioni sopraindicate.", {
    x: 145,
    y: annullamentoY,
    size: 8,
    font: fontRegular,
    color: colorNero,
  });
  
  // Nota obbligatorietà
  page.drawText("I campi contrassegnati con * sono obbligatori.", {
    x: 45,
    y: 250,
    size: 8.5,
    font: fontRegular,
    color: colorNero,
  });
  
  // --- PULSANTI ESTETICI IN BASSO ---
  // Pulsante 1: Genera XML e invia via email
  page.drawRectangle({
    x: 45,
    y: 180,
    width: 200,
    height: 24,
    color: colorGrigioPulsante,
    borderColor: colorNero,
    borderWidth: 1,
  });
  
  const txtPulsante1 = "Genera XML e invia via email";
  const wP1 = fontRegular.widthOfTextAtSize(txtPulsante1, 9);
  page.drawText(txtPulsante1, {
    x: 45 + (200 - wP1) / 2,
    y: 188,
    size: 9,
    font: fontRegular,
    color: colorNero,
  });
  
  // Pulsante 2: Stampa
  page.drawRectangle({
    x: 255,
    y: 180,
    width: 110,
    height: 24,
    color: colorGrigioPulsante,
    borderColor: colorNero,
    borderWidth: 1,
  });
  
  const txtPulsante2 = "Stampa";
  const wP2 = fontRegular.widthOfTextAtSize(txtPulsante2, 9);
  page.drawText(txtPulsante2, {
    x: 255 + (110 - wP2) / 2,
    y: 188,
    size: 9,
    font: fontRegular,
    color: colorNero,
  });
  
  // Stampiamo sul fondo della pagina un watermark/riferimento di cortesia
  page.drawText(`Firma del lavoratore: ${lavoratore.nominativo} • Generato tramite Compilatore Intermittenti`, {
    x: 45,
    y: 50,
    size: 7.5,
    font: fontRegular,
    color: rgb(0.5, 0.5, 0.5),
  });
  
  return await pdfDoc.save();
}

// Genera un unico PDF cumulativo contenente tutte le pagine dei lavoratori raggruppati
export async function generateCombinedIntermittentiPdf(
  employer: EmployerConfig,
  lavoratori: LavoratoreRaggruppato[]
): Promise<Uint8Array> {
  const mergedPdf = await PDFDocument.create();
  
  for (const lavoratore of lavoratori) {
    // Genera singola pagina PDF per questo lavoratore
    const singlePdfBytes = await generateIntermittentePdf(employer, lavoratore);
    
    // Carica e copia le pagine nel PDF cumulativo
    const tempPdf = await PDFDocument.load(singlePdfBytes);
    const copiedPages = await mergedPdf.copyPages(tempPdf, tempPdf.getPageIndices());
    copiedPages.forEach(page => mergedPdf.addPage(page));
  }
  
  return await mergedPdf.save();
}
