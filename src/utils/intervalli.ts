import { Prestazione } from '../types';
import { parseDateIT } from './dates';

export interface IntervalloLavorativo {
  dataInizio: string; // "DD/MM/YYYY"
  dataFine: string; // "DD/MM/YYYY"
  giorni: string[]; // es. ["SAB", "DOM", "LUN"]
}

const GIORNO_MS = 24 * 60 * 60 * 1000;

// Unisce le giornate consecutive in un unico intervallo data inizio / data fine
export function getIntervalliLavorativi(prestazioni: Prestazione[]): IntervalloLavorativo[] {
  // Ordina per data reale ed elimina le date ripetute
  const viste = new Set<string>();
  const ordinate = prestazioni
    .filter(p => p.data && !viste.has(p.data) && viste.add(p.data))
    .sort((a, b) => parseDateIT(a.data).getTime() - parseDateIT(b.data).getTime());

  const intervalli: IntervalloLavorativo[] = [];
  for (const prest of ordinate) {
    const ultimo = intervalli[intervalli.length - 1];
    // Math.round assorbe le giornate da 23 o 25 ore del cambio d'ora
    const consecutiva = ultimo !== undefined &&
      Math.round((parseDateIT(prest.data).getTime() - parseDateIT(ultimo.dataFine).getTime()) / GIORNO_MS) === 1;

    if (consecutiva) {
      ultimo.dataFine = prest.data;
      ultimo.giorni.push(prest.giorno);
    } else {
      intervalli.push({ dataInizio: prest.data, dataFine: prest.data, giorni: [prest.giorno] });
    }
  }
  return intervalli;
}
