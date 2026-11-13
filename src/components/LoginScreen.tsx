import { useEffect, useRef, useState } from 'react';
import { Lock, ShieldAlert } from 'lucide-react';
import { motion } from 'motion/react';
import { UserSession } from '../types';
import { GOOGLE_CLIENT_ID, sessionFromCredential } from '../utils/auth';

// Estensione di Window per supportare l'SDK Google Identity Services
declare global {
  interface Window {
    google?: any;
  }
}

const GSI_SCRIPT_ID = 'google-gsi-client';

interface LoginScreenProps {
  onLogin: (session: UserSession) => void;
}

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  const [authError, setAuthError] = useState<string | null>(null);
  const buttonRef = useRef<HTMLDivElement>(null);

  // Caricamento dello script Google Identity Services e rendering del pulsante
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;

    const initGSI = () => {
      if (!window.google || !buttonRef.current) return;
      try {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          ux_mode: 'popup',
          callback: (response: { credential?: string }) => {
            const result = sessionFromCredential(response.credential ?? '');
            if ('error' in result) {
              setAuthError(result.error);
            } else {
              setAuthError(null);
              onLogin(result.session);
            }
          },
        });
        window.google.accounts.id.renderButton(buttonRef.current, { theme: 'outline', size: 'large', width: 320, shape: 'pill' });
      } catch (err) {
        console.error('Errore inizializzazione GSI:', err);
      }
    };

    if (window.google) {
      initGSI();
      return;
    }

    let script = document.getElementById(GSI_SCRIPT_ID) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement('script');
      script.id = GSI_SCRIPT_ID;
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      document.body.appendChild(script);
    }
    const gsiScript = script;
    gsiScript.addEventListener('load', initGSI);
    return () => gsiScript.removeEventListener('load', initGSI);
  }, [onLogin]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col justify-between items-center p-4 sm:p-6 md:p-8 relative overflow-hidden" id="login-container">
      {/* Sfondo geometrico decorativo */}
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:16px_16px] opacity-70 pointer-events-none" />
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-100 rounded-full blur-3xl opacity-50 pointer-events-none" />
      <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-indigo-100 rounded-full blur-3xl opacity-50 pointer-events-none" />

      <div className="w-full max-w-lg my-auto relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl border border-slate-200/80 shadow-2xl p-6 sm:p-8 space-y-6"
        >
          <div className="text-center space-y-3">
            <div className="inline-flex bg-blue-600 p-3.5 rounded-2xl text-white shadow-lg shadow-blue-600/20">
              <Lock className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">Berti Food S.r.l.</h1>
              <p className="text-xs sm:text-sm text-slate-500 font-semibold uppercase tracking-wider">Portale Lavoratori Intermittenti</p>
            </div>
            <div className="h-px bg-slate-100 w-24 mx-auto" />
            <p className="text-xs text-slate-400 font-medium max-w-sm mx-auto leading-relaxed">
              Questo portale è riservato. Effettua l'accesso con Google per iniziare a compilare e gestire i contratti a chiamata.
            </p>
          </div>

          <div className="space-y-4 pt-2">
            {authError && (
              <div className="bg-red-50 border border-red-200/60 rounded-2xl p-4 flex gap-3 text-left" role="alert">
                <ShieldAlert className="w-5 h-5 mt-0.5 text-red-600 shrink-0" />
                <div className="space-y-1">
                  <div className="font-bold text-xs text-red-800 uppercase tracking-wider">Accesso Negato</div>
                  <p className="text-xs text-red-700 leading-relaxed">{authError}</p>
                </div>
              </div>
            )}

            {GOOGLE_CLIENT_ID ? (
              <div className="flex flex-col items-center justify-center space-y-2">
                <div ref={buttonRef} id="google-signin-button" className="min-h-[50px] flex items-center justify-center" />
                <p className="text-[10px] text-slate-400 font-medium text-center">Autenticazione sicura tramite Google OAuth 2.0</p>
              </div>
            ) : (
              <div className="bg-amber-50 border border-amber-200/60 rounded-2xl p-4 text-center space-y-3">
                <div className="flex items-center justify-center gap-1.5 text-amber-600 font-bold text-xs uppercase tracking-wider">
                  <ShieldAlert className="w-4 h-4" />
                  Accesso temporaneamente non disponibile
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  L'ID Client Google non è configurato per questa istanza. Contatta l'amministratore di sistema.
                </p>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      <div className="w-full text-center py-4 text-[10px] text-slate-400 font-medium">
        &copy; 2026 Berti Food S.r.l. &bull; Tutti i diritti riservati &bull; Portale Gestione Contratti Intermittenti v1.5
      </div>
    </div>
  );
}
