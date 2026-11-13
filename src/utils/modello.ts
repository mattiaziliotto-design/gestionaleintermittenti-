import modelloUrl from '../assets/modello-uni-intermittente.pdf?url';
import { EmployerConfig, LavoratoreRaggruppato } from '../types';

// Il modello ministeriale e la libreria PDF vengono scaricati solo al primo utilizzo
let modello: Promise<Uint8Array> | null = null;

function caricaModello(): Promise<Uint8Array> {
  modello ??= fetch(modelloUrl)
    .then(res => {
      if (!res.ok) throw new Error(`Modello ministeriale non disponibile (${res.status})`);
      return res.arrayBuffer();
    })
    .then(buffer => new Uint8Array(buffer))
    .catch(err => {
      modello = null; // consente di riprovare
      throw err;
    });
  return modello;
}

const generatore = () => import('./pdfGenerator');

// Un unico PDF con un modulo ministeriale (pagina) per ciascun lavoratore
export async function creaPdfUnico(employer: EmployerConfig, lavoratori: LavoratoreRaggruppato[]): Promise<Uint8Array> {
  const [bytes, { generaPdfUnico }] = await Promise.all([caricaModello(), generatore()]);
  return generaPdfUnico(bytes, employer, lavoratori);
}
