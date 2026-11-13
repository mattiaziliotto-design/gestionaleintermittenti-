import { UserSession } from '../types';
import { loadStoredSession } from './storage';

// Durata massima della sessione salvata nel browser
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const GOOGLE_ISSUERS = ['accounts.google.com', 'https://accounts.google.com'];
const DOMINIO_AZIENDALE = '@bertifood.it';

export const GOOGLE_CLIENT_ID: string = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

// Decodifica il payload del token JWT inviato da Google
function parseJwt(token: string): Record<string, unknown> | null {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const bytes = Uint8Array.from(window.atob(base64), c => c.charCodeAt(0));
    const payload = JSON.parse(new TextDecoder().decode(bytes));
    return typeof payload === 'object' && payload !== null ? payload : null;
  } catch (error) {
    console.error('Errore decodifica JWT:', error);
    return null;
  }
}

// Email autorizzate oltre al dominio aziendale (variabile d'ambiente VITE_ALLOWED_EMAILS, separate da virgola)
function getAllowedEmails(): string[] {
  const env: string = import.meta.env.VITE_ALLOWED_EMAILS || '';
  return env
    .split(',')
    .map(e => e.replace(/['"]/g, '').trim().toLowerCase())
    .filter(Boolean);
}

export function isEmailAllowed(email: string): boolean {
  const clean = email.trim().toLowerCase();
  if (!clean) return false;
  return clean.endsWith(DOMINIO_AZIENDALE) || getAllowedEmails().includes(clean);
}

export type LoginResult = { session: UserSession } | { error: string };

// Controlla il token restituito da Google: emittente, destinatario, scadenza, email verificata e autorizzata
export function sessionFromCredential(credential: string, now = Date.now()): LoginResult {
  const payload = parseJwt(credential);
  const genericError = { error: "Errore durante l'autenticazione con Google." };
  if (!payload) return genericError;

  const { iss, aud, exp, email, email_verified: emailVerified, name, given_name: givenName, picture } = payload;
  const tokenValido =
    typeof iss === 'string' && GOOGLE_ISSUERS.includes(iss) &&
    GOOGLE_CLIENT_ID !== '' && aud === GOOGLE_CLIENT_ID &&
    typeof exp === 'number' && exp * 1000 > now;
  if (!tokenValido || typeof email !== 'string' || !email) return genericError;

  if (emailVerified !== true && emailVerified !== 'true') {
    return { error: `L'indirizzo ${email} non risulta verificato da Google.` };
  }
  if (!isEmailAllowed(email)) {
    return { error: `L'account ${email} non è autorizzato ad accedere.` };
  }

  return {
    session: {
      email,
      name: (typeof name === 'string' && name) || (typeof givenName === 'string' && givenName) || 'Utente Google',
      picture: typeof picture === 'string' ? picture : undefined,
      provider: 'google',
      loggedInAt: new Date(now).toISOString(),
    },
  };
}

// Ripristina la sessione salvata solo se è ancora valida e l'email è tuttora autorizzata
export function restoreSession(now = Date.now()): UserSession | null {
  const session = loadStoredSession();
  if (!session) return null;
  const age = now - new Date(session.loggedInAt).getTime();
  if (Number.isNaN(age) || age < 0 || age >= SESSION_TTL_MS) return null;
  return isEmailAllowed(session.email) ? session : null;
}
