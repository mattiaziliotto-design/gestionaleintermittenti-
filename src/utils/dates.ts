export const GIORNI = ['LUN', 'MAR', 'MER', 'GIO', 'VEN', 'SAB', 'DOM'] as const;
export type Giorno = (typeof GIORNI)[number];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isISODate(value: unknown): value is string {
  return typeof value === 'string' && ISO_DATE.test(value) && !Number.isNaN(parseISODateLocal(value).getTime());
}

// Converte "YYYY-MM-DD" in una Date a mezzanotte locale
// (new Date("YYYY-MM-DD") la interpreterebbe in UTC, spostando il giorno in alcuni fusi/orari)
export function parseISODateLocal(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// Converte "DD/MM/YYYY" in una Date a mezzanotte locale
export function parseDateIT(dStr: string): Date {
  const [d, m, y] = dStr.split('/').map(Number);
  return new Date(y, m - 1, d);
}

export function formatDateIT(date: Date): string {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${date.getFullYear()}`;
}

// Restituisce il lunedì della settimana di una data, come "YYYY-MM-DD" in ora locale
// (toISOString() userebbe UTC: dopo mezzanotte in Italia restituirebbe il giorno prima)
export function getMondayISO(date: Date): string {
  const day = date.getDay();
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate() - day + (day === 0 ? -6 : 1));
  const mm = String(monday.getMonth() + 1).padStart(2, '0');
  const dd = String(monday.getDate()).padStart(2, '0');
  return `${monday.getFullYear()}-${mm}-${dd}`;
}

// Riconosce il giorno della settimana da sigla o nome esteso ("SAB", "sabato", "Lunedì")
export function normalizeGiorno(value: string): Giorno | null {
  const clean = value.toUpperCase().trim();
  return GIORNI.find(g => clean.startsWith(g)) ?? null;
}

// Data "DD/MM/YYYY" di un giorno nella settimana che inizia dal lunedì indicato
export function dateForGiorno(mondayISO: string, giorno: string): string {
  const g = normalizeGiorno(giorno);
  if (!g) return '';
  const monday = parseISODateLocal(mondayISO);
  return formatDateIT(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + GIORNI.indexOf(g)));
}

export function getWeekDays(mondayISO: string) {
  return GIORNI.map(name => {
    const dateStr = dateForGiorno(mondayISO, name);
    return { name, dateStr, formattedShort: dateStr.substring(0, 5) };
  });
}
