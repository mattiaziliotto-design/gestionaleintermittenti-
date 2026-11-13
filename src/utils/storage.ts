import { ElaborazioneStorica, EmployerConfig, InputRow, LavoratoreRaggruppato, UserSession } from '../types';
import { getMondayISO, isISODate, parseISODateLocal } from './dates';

// Chiavi di localStorage: non vanno rinominate, contengono i dati già salvati dagli utenti
const KEY_EMPLOYER = 'interm_employer_config';
const KEY_STORICO = 'interm_storico_elaborazioni';
const KEY_SESSION = 'interm_user_session';

// Valori predefiniti del datore di lavoro
export const DEFAULT_EMPLOYER: EmployerConfig = {
  codiceFiscale: '05024410267',
  email: 'bertifoodsrl@gmail.com',
};

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);

function readJson(key: string): unknown {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : null;
  } catch {
    // Dato illeggibile: lo si lascia dov'è (non viene cancellato) e si parte dai valori predefiniti
    return null;
  }
}

// Restituisce false se il salvataggio non è riuscito (es. spazio del browser esaurito)
function writeJson(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    console.error(`Salvataggio di ${key} non riuscito:`, err);
    return false;
  }
}

function sanitizeEmployer(value: unknown): EmployerConfig {
  if (!isRecord(value)) return { ...DEFAULT_EMPLOYER };
  return {
    codiceFiscale: str(value.codiceFiscale, DEFAULT_EMPLOYER.codiceFiscale),
    email: str(value.email, DEFAULT_EMPLOYER.email),
  };
}

function sanitizeLavoratori(value: unknown): LavoratoreRaggruppato[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map(lav => ({
    codiceFiscale: str(lav.codiceFiscale),
    nominativo: str(lav.nominativo),
    prestazioni: Array.isArray(lav.prestazioni)
      ? lav.prestazioni.filter(isRecord).map(p => ({ giorno: str(p.giorno), data: str(p.data) }))
      : [],
  }));
}

function sanitizeRows(value: unknown): InputRow[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((row, i) => ({
    id: str(row.id, `row-${i}`),
    codiceFiscale: str(row.codiceFiscale),
    nominativo: str(row.nominativo),
    giornoLavoro: str(row.giornoLavoro),
    ...(typeof row.rigaOriginale === 'number' ? { rigaOriginale: row.rigaOriginale } : {}),
  }));
}

// Valida un elenco di elaborazioni completando i campi mancanti.
// strict = true (file di backup importato): restituisce null se anche una sola voce non è riconoscibile.
// strict = false (dati già salvati nel browser): recupera tutto il possibile e scarta solo le voci inutilizzabili.
export function sanitizeStorico(value: unknown, strict = true): ElaborazioneStorica[] | null {
  if (!Array.isArray(value)) return null;
  const result: ElaborazioneStorica[] = [];

  value.forEach((item, index) => {
    if (!isRecord(item) || !Array.isArray(item.lavoratoriElaborati)) return;
    if (strict && (typeof item.id !== 'string' || typeof item.titolo !== 'string')) return;

    const createdAt = Number.isNaN(new Date(str(item.createdAt)).getTime()) ? new Date().toISOString() : str(item.createdAt);
    result.push({
      id: str(item.id) || `elab-recuperata-${index}`,
      titolo: str(item.titolo) || 'Elaborazione senza titolo',
      createdAt,
      selectedDate: isISODate(item.selectedDate)
        ? getMondayISO(parseISODateLocal(item.selectedDate))
        : getMondayISO(new Date(createdAt)),
      employer: sanitizeEmployer(item.employer),
      rawRows: sanitizeRows(item.rawRows),
      lavoratoriElaborati: sanitizeLavoratori(item.lavoratoriElaborati),
      inputMethod: item.inputMethod === 'upload' ? 'upload' : 'paste',
      pastedText: str(item.pastedText),
    });
  });

  return strict && result.length !== value.length ? null : result;
}

// Carica lo storico salvato. Se una parte non è leggibile, conserva una copia integrale
// dell'originale in una chiave separata prima che un salvataggio successivo possa sovrascriverlo.
export function loadStorico(): ElaborazioneStorica[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY_STORICO);
  } catch {
    return [];
  }
  if (!raw) return [];

  let parsed: unknown = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = null;
  }
  const storico = sanitizeStorico(parsed, false);
  if (!storico || storico.length !== (parsed as unknown[]).length) {
    try {
      localStorage.setItem(`${KEY_STORICO}_copia_${Date.now()}`, raw);
    } catch (err) {
      console.error('Copia di sicurezza dello storico non riuscita:', err);
    }
  }
  return storico ?? [];
}

export const loadEmployer = (): EmployerConfig => sanitizeEmployer(readJson(KEY_EMPLOYER));
export const saveEmployer = (employer: EmployerConfig): boolean => writeJson(KEY_EMPLOYER, employer);

export const saveStorico = (storico: ElaborazioneStorica[]): boolean => writeJson(KEY_STORICO, storico);

export function loadStoredSession(): UserSession | null {
  const value = readJson(KEY_SESSION);
  if (!isRecord(value) || typeof value.email !== 'string' || typeof value.loggedInAt !== 'string') return null;
  return {
    email: value.email,
    name: str(value.name, value.email),
    picture: typeof value.picture === 'string' ? value.picture : undefined,
    provider: 'google',
    loggedInAt: value.loggedInAt,
  };
}
export const saveSession = (session: UserSession): boolean => writeJson(KEY_SESSION, session);

export function clearSession(): void {
  try {
    localStorage.removeItem(KEY_SESSION);
  } catch {
    // nessuna azione: la sessione in memoria viene comunque azzerata
  }
}
