import { PDFArray, PDFDict, PDFDocument, PDFFont, PDFName, PDFString, StandardFonts } from 'pdf-lib';
import { EmployerConfig, LavoratoreRaggruppato } from '../types';
import { RIGHE_PER_MODULO, RigaModulo, righeDaLavoratori } from './intervalli';

// Nomi dei campi del modello ministeriale
const PREFISSO = 'moduloIntermittenti[0].Campi[0].';
const CAMPO_CF_DATORE = `${PREFISSO}CFdatorelavoro[0]`;
const CAMPO_EMAIL = `${PREFISSO}EMmail[0]`;
const campoRiga = (nome: string, riga: number) => `${PREFISSO}Table1[0].Row${riga}[0].${nome}${riga}[0]`;

// Il font dei campi copre solo l'alfabeto occidentale: i caratteri non disponibili vengono
// sostituiti, altrimenti la generazione dell'intero documento andrebbe in errore
function testoStampabile(text: string, font: PDFFont): string {
  const supportati = new Set(font.getCharacterSet());
  return Array.from(text.trim(), char => {
    if (supportati.has(char.codePointAt(0)!)) return char;
    const base = char.normalize('NFD').replace(/[̀-ͯ]/g, '');
    return base !== '' && [...base].every(c => supportati.has(c.codePointAt(0)!)) ? base : '?';
  }).join('');
}

// Compila una copia del modello ministeriale con al massimo 10 righe.
// I campi restano modificabili, come nel modulo scaricato dal portale.
async function compilaModulo(modello: Uint8Array, employer: EmployerConfig, righe: RigaModulo[]): Promise<PDFDocument> {
  const doc = await PDFDocument.load(modello);
  const page = doc.getPage(0);

  // L'elenco dei campi viene ricostruito dai controlli presenti sulla pagina,
  // così la compilazione non dipende dall'indice dei campi salvato nel file
  const acroForm = doc.catalog.lookup(PDFName.of('AcroForm'), PDFDict);
  acroForm.set(PDFName.of('Fields'), doc.context.obj(page.node.Annots()?.asArray() ?? []));

  const form = doc.getForm();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const scrivi = (campo: string, valore: string) => form.getTextField(campo).setText(testoStampabile(valore, font));

  scrivi(CAMPO_CF_DATORE, employer.codiceFiscale);
  scrivi(CAMPO_EMAIL, employer.email);
  for (let i = 1; i <= RIGHE_PER_MODULO; i++) {
    const riga = righe[i - 1];
    scrivi(campoRiga('CFlavoratore', i), riga?.codiceFiscale ?? '');
    scrivi(campoRiga('CCcodcomunicazione', i), '');
    scrivi(campoRiga('DTdatainizio', i), riga?.dataInizio ?? '');
    scrivi(campoRiga('DTdatafine', i), riga?.dataFine ?? '');
  }
  form.updateFieldAppearances(font);
  return doc;
}

function suddividi(righe: RigaModulo[]): RigaModulo[][] {
  const gruppi: RigaModulo[][] = [];
  for (let i = 0; i < righe.length; i += RIGHE_PER_MODULO) gruppi.push(righe.slice(i, i + RIGHE_PER_MODULO));
  return gruppi.length > 0 ? gruppi : [[]];
}

// Genera un unico PDF con tutti i moduli necessari, una pagina ogni 10 righe.
// Dalla seconda pagina i campi ricevono un suffisso: in un PDF due campi con lo stesso nome
// condividerebbero il valore, e ogni pagina mostrerebbe le righe della prima.
export async function generaPdfUnico(modello: Uint8Array, employer: EmployerConfig, lavoratori: LavoratoreRaggruppato[]): Promise<Uint8Array> {
  const [prime, ...altre] = suddividi(righeDaLavoratori(lavoratori));
  const doc = await compilaModulo(modello, employer, prime);
  const campi = doc.catalog.lookup(PDFName.of('AcroForm'), PDFDict).lookup(PDFName.of('Fields'), PDFArray);

  for (const [indice, righe] of altre.entries()) {
    const modulo = await compilaModulo(modello, employer, righe);
    for (const campo of modulo.getForm().getFields()) {
      campo.acroField.dict.set(PDFName.of('T'), PDFString.of(`${campo.getName()}#${indice + 2}`));
    }
    const [pagina] = await doc.copyPages(modulo, [0]);
    doc.addPage(pagina);
    for (const controllo of pagina.node.Annots()?.asArray() ?? []) {
      campi.push(controllo);
    }
  }
  return doc.save();
}
