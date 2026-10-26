import React, { useState, useEffect, useRef } from 'react';
import { EmployerConfig, InputRow, LavoratoreRaggruppato, ElaborazioneStorica, UserSession } from './types';
import { generateIntermittentePdf, generateCombinedIntermittentiPdf, getIntervalliLavorativi } from './utils/pdfGenerator';
import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import { 
  Building2, Users, FileText, Download, Trash2, Edit2, Check,
  CalendarDays, FileSpreadsheet, UploadCloud, Info, AlertTriangle, 
  Eye, CheckCircle2, RotateCcw, HelpCircle, FileCheck, RefreshCw,
  History, Save, FolderOpen, FileDown, FileUp, Archive,
  LogIn, LogOut, Lock, ShieldCheck, Mail, Laptop, ShieldAlert
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Estensione di Window per supportare l'SDK Google Identity Services
declare global {
  interface Window {
    google?: any;
  }
}

// Funzione helper sicura per decodificare il JWT inviato da Google
function parseJwt(token: string): any {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      window
        .atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error("Errore decodifica JWT:", error);
    return null;
  }
}


// Converte "YYYY-MM-DD" in una Date a mezzanotte locale
// (new Date("YYYY-MM-DD") la interpreterebbe in UTC, spostando il giorno in alcuni fusi/orari)
function parseISODateLocal(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// Restituisce il lunedì della settimana di una data, come "YYYY-MM-DD" in ora locale
// (toISOString() userebbe UTC: dopo mezzanotte in Italia restituirebbe il giorno prima)
function getMondayISO(date: Date): string {
  const day = date.getDay();
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate() - day + (day === 0 ? -6 : 1));
  const mm = String(monday.getMonth() + 1).padStart(2, '0');
  const dd = String(monday.getDate()).padStart(2, '0');
  return `${monday.getFullYear()}-${mm}-${dd}`;
}

// Valori predefiniti dall'immagine del modulo ministeriale allegata
const DEFAULT_EMPLOYER: EmployerConfig = {
  codiceFiscale: "05024410267",
  email: "bertifoodsrl@gmail.com"
};

export default function App() {
  // Stato sessione utente (Login con Google / Demo)
  const [session, setSession] = useState<UserSession | null>(() => {
    const saved = localStorage.getItem('interm_user_session');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const loggedAt = new Date(parsed.loggedInAt).getTime();
        const now = new Date().getTime();
        // Validità della sessione: 30 giorni
        if (now - loggedAt < 30 * 24 * 60 * 60 * 1000) {
          return parsed;
        }
      } catch (e) {
        // ignora errore parsing
      }
    }
    return null;
  });

  // Client ID ottenuto da variabile d'ambiente .env
  const [customClientId] = useState<string>(() => {
    // Rimuovi eventuale vecchio id client salvato in locale per evitare conflitti o dati obsoleti
    localStorage.removeItem('interm_custom_client_id');
    return import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
  });

  // Stato per mostrare il dialog di conferma disconnessione
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);

  // Stato errore autenticazione
  const [authError, setAuthError] = useState<string | null>(null);

  // Stato datore di lavoro
  const [employer, setEmployer] = useState<EmployerConfig>(() => {
    const saved = localStorage.getItem('interm_employer_config');
    return saved ? JSON.parse(saved) : DEFAULT_EMPLOYER;
  });

  // Gestore del login riuscito con Google
  const handleCredentialResponse = (response: any) => {
    setAuthError(null);
    const payload = parseJwt(response.credential);
    if (payload) {
      const email = payload.email?.toLowerCase();
      
      // Controllo whitelist (da variabile d'ambiente VITE_ALLOWED_EMAILS) e auto-approvazione dominio bertifood.it
      const allowedEmailsEnv = import.meta.env.VITE_ALLOWED_EMAILS;

      let allowedList: string[] = [];
      if (allowedEmailsEnv) {
        // Rimuove eventuali virgolette all'inizio/fine o all'interno di ciascuna email
        const cleanedEnv = allowedEmailsEnv.replace(/^['"]|['"]$/g, '');
        allowedList = cleanedEnv
          .split(',')
          .map((e: string) => e.replace(/['"]/g, '').trim().toLowerCase())
          .filter(Boolean);
      }

      // Consente l'accesso a tutte le email @bertifood.it o a quelle presenti nella whitelist
      const isBertiFoodDomain = email ? email.endsWith('@bertifood.it') : false;

      if (email && !allowedList.includes(email) && !isBertiFoodDomain) {
        setAuthError(`L'account ${payload.email} non è autorizzato ad accedere.`);
        return;
      }

      const googleSession: UserSession = {
        email: payload.email,
        name: payload.name || payload.given_name || 'Utente Google',
        picture: payload.picture,
        provider: 'google',
        loggedInAt: new Date().toISOString()
      };
      setSession(googleSession);
      localStorage.setItem('interm_user_session', JSON.stringify(googleSession));
    } else {
      setAuthError("Errore durante l'autenticazione con Google.");
    }
  };

  // Caricamento asincrono dello script GSI e rendering pulsante
  useEffect(() => {
    if (session) return;

    let script = document.getElementById('google-gsi-client') as HTMLScriptElement;
    if (!script) {
      script = document.createElement('script');
      script.id = 'google-gsi-client';
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);
    }

    const initGSI = () => {
      if (window.google && customClientId) {
        try {
          window.google.accounts.id.initialize({
            client_id: customClientId,
            callback: handleCredentialResponse,
            ux_mode: 'popup',
          });
          
          const container = document.getElementById("google-signin-button");
          if (container) {
            window.google.accounts.id.renderButton(
              container,
              { theme: "outline", size: "large", width: 320, shape: "pill" }
            );
          }
        } catch (err) {
          console.error("Errore inizializzazione GSI:", err);
        }
      }
    };

    script.onload = () => {
      initGSI();
    };

    if (window.google) {
      initGSI();
    } else {
      const interval = setInterval(() => {
        if (window.google) {
          initGSI();
          clearInterval(interval);
        }
      }, 300);
      return () => clearInterval(interval);
    }
  }, [session, customClientId]);

  const handleSignOut = () => {
    setSession(null);
    localStorage.removeItem('interm_user_session');
    setShowSignOutConfirm(false);
  };



  // Data della settimana di riferimento (Lunedì)
  // Di default, imposta il lunedì della settimana corrente (YYYY-MM-DD)
  const [selectedDate, setSelectedDate] = useState<string>(() => getMondayISO(new Date()));

  // Metodi di input dei dati
  const [inputMethod, setInputMethod] = useState<'paste' | 'upload'>('paste');
  const [pastedText, setPastedText] = useState<string>('');
  const [dragActive, setDragActive] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Righe grezze inserite
  const [rawRows, setRawRows] = useState<InputRow[]>([]);
  
  // Lavoratori elaborati e raggruppati
  const [lavoratoriElaborati, setLavoratoriElaborati] = useState<LavoratoreRaggruppato[]>([]);
  
  // Stato elaborazione e messaggi
  const [isProcessed, setIsProcessed] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  
  // Lavoratore selezionato per l'anteprima PDF
  const [selectedLavoratorePreview, setSelectedLavoratorePreview] = useState<LavoratoreRaggruppato | null>(null);
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState<boolean>(false);

  // Stato per l'editing rapido di un lavoratore
  const [editingLavoratore, setEditingLavoratore] = useState<LavoratoreRaggruppato | null>(null);

  // Stato archivio storico
  const [storico, setStorico] = useState<ElaborazioneStorica[]>(() => {
    const saved = localStorage.getItem('interm_storico_elaborazioni');
    return saved ? JSON.parse(saved) : [];
  });
  
  // Stato visibilità storico
  const [isStoricoExpanded, setIsStoricoExpanded] = useState<boolean>(false);
  
  // Titolo per il salvataggio corrente
  const [currentSaveTitle, setCurrentSaveTitle] = useState<string>('');
  const [showSaveDialog, setShowSaveDialog] = useState<boolean>(false);

  // Sync su LocalStorage
  useEffect(() => {
    localStorage.setItem('interm_employer_config', JSON.stringify(employer));
  }, [employer]);

  // Calcolo del lunedì e delle date della settimana
  const mondayDate = parseISODateLocal(selectedDate);
  
  const getWeekDays = () => {
    const days = ['LUN', 'MAR', 'MER', 'GIO', 'VEN', 'SAB', 'DOM'];
    return days.map((dayName, index) => {
      const d = new Date(mondayDate);
      d.setDate(mondayDate.getDate() + index);
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      return {
        name: dayName,
        dateStr: `${dd}/${mm}/${d.getFullYear()}`,
        formattedShort: `${dd}/${mm}`
      };
    });
  };

  const weekDays = getWeekDays();

  // Helper per mappare SAB, DOM, LUN alla data reale
  const getDateForDay = (dayName: string): string => {
    const cleanDay = dayName.toUpperCase().trim();
    let offset = -1;
    
    if (cleanDay.startsWith('LUN')) offset = 0;
    else if (cleanDay.startsWith('MAR')) offset = 1;
    else if (cleanDay.startsWith('MER')) offset = 2;
    else if (cleanDay.startsWith('GIO')) offset = 3;
    else if (cleanDay.startsWith('VEN')) offset = 4;
    else if (cleanDay.startsWith('SAB')) offset = 5;
    else if (cleanDay.startsWith('DOM')) offset = 6;
    
    if (offset === -1) return '';
    
    const targetDate = new Date(mondayDate);
    targetDate.setDate(mondayDate.getDate() + offset);
    
    const dd = String(targetDate.getDate()).padStart(2, '0');
    const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}/${targetDate.getFullYear()}`;
  };

  // Parsing del testo incollato da Excel
  const parsePastedData = (text: string) => {
    const lines = text.split('\n');
    const rows: InputRow[] = [];
    
    lines.forEach((line, index) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      
      let parts: string[] = [];
      if (trimmed.includes('\t')) {
        parts = trimmed.split('\t');
      } else if (trimmed.includes(';')) {
        parts = trimmed.split(';');
      } else if (trimmed.includes(',')) {
        parts = trimmed.split(',');
      } else {
        parts = trimmed.split(/\s{2,}/); // Due o più spazi consecutivi
      }
      
      const cleanParts = parts.map(p => p.trim());
      
      if (cleanParts.length >= 2) {
        const cf = cleanParts[0];
        const nominativo = cleanParts[1];
        const giorno = cleanParts[2] || '';
        
        // Salta intestazioni se presenti (confronto esatto: un CF reale può contenere la sequenza "CF")
        const cfUpper = cf.toUpperCase();
        if (cfUpper === 'CF' || cfUpper.startsWith('CODICE FISCALE') || cfUpper.startsWith('CODICE_FISCALE')) {
          return;
        }
        
        // Verifica basica codice fiscale o nominativo per evitare righe vuote
        if (cf.length > 5 && nominativo.length > 2) {
          rows.push({
            id: `paste-${index}-${Math.random().toString(36).substr(2, 4)}`,
            codiceFiscale: cf,
            nominativo: nominativo,
            giornoLavoro: giorno
          });
        }
      }
    });
    
    return rows;
  };

  // Lettura del file Excel con libreria xlsx
  const handleExcelParsing = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
        
        const rows: InputRow[] = [];
        let cfIndex = 0;
        let nameIndex = 1;
        let dayIndex = 2;
        let startRow = 0;
        
        if (jsonData.length > 0) {
          const firstRow = jsonData[0].map(cell => String(cell || '').toUpperCase().trim());
          const foundCf = firstRow.findIndex(cell => cell.includes('CODICE FISCALE') || cell === 'CF' || cell.includes('FISCALE'));
          const foundName = firstRow.findIndex(cell => cell.includes('NOME') || cell.includes('COGNOME') || cell.includes('DIPENDENTE') || cell.includes('NOMINATIVO') || cell.includes('LAVORATORE'));
          const foundDay = firstRow.findIndex(cell => cell.includes('GIORNO') || cell.includes('LAVORO') || cell.includes('SERVIZIO') || cell.includes('SETTIMANA'));
          
          if (foundCf !== -1) cfIndex = foundCf;
          if (foundName !== -1) nameIndex = foundName;
          if (foundDay !== -1) dayIndex = foundDay;
          
          if (foundCf !== -1 || foundName !== -1 || foundDay !== -1) {
            startRow = 1; // Salta l'intestazione
          }
        }
        
        for (let i = startRow; i < jsonData.length; i++) {
          const rowData = jsonData[i];
          if (!rowData || rowData.length < 2) continue;
          
          const cf = String(rowData[cfIndex] || '').trim();
          const nominativo = String(rowData[nameIndex] || '').trim();
          const giorno = String(rowData[dayIndex] || '').trim();
          
          if (cf && cf.length > 5 && nominativo) {
            rows.push({
              id: `excel-${i}-${Math.random().toString(36).substr(2, 4)}`,
              codiceFiscale: cf,
              nominativo: nominativo,
              giornoLavoro: giorno,
              rigaOriginale: i + 1
            });
          }
        }
        
        if (rows.length === 0) {
          alert("Nessuna riga valida trovata nel file Excel. Assicurati che le colonne contengano Codice Fiscale, Nome/Cognome e Giorno di Lavoro.");
        } else {
          setRawRows(rows);
          // Auto-elabora se abbiamo caricato un file
          avvisaRigheNonRiconosciute(elaboraDati(rows));
        }
      } catch (err) {
        console.error(err);
        alert("Errore nel leggere il file Excel. Assicurati che sia un file .xlsx, .xls o .csv valido.");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Drag and drop event handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleExcelParsing(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleExcelParsing(e.target.files[0]);
    }
  };

  // Esecuzione dell'elaborazione e raggruppamento
  const handleElaboraPaste = () => {
    if (!pastedText.trim()) {
      alert("Incolla prima dei dati dall'Excel nell'area di testo!");
      return;
    }
    const rows = parsePastedData(pastedText);
    if (rows.length === 0) {
      alert("Nessun dato valido individuato. Controlla il formato (colonna 1: Codice Fiscale, colonna 2: Nome e Cognome, colonna 3: Giorno di lavoro).");
      return;
    }
    setRawRows(rows);
    avvisaRigheNonRiconosciute(elaboraDati(rows));
  };

  // Restituisce le righe il cui giorno non è stato riconosciuto (es. vuoto, data, testo libero)
  const elaboraDati = (rows: InputRow[]): InputRow[] => {
    const groups: Record<string, { nominativo: string; prestazioni: { giorno: string; data: string }[] }> = {};
    const righeNonRiconosciute: InputRow[] = [];

    rows.forEach(row => {
      const cf = row.codiceFiscale.toUpperCase().trim();
      if (!cf) return;
      
      if (!groups[cf]) {
        groups[cf] = {
          nominativo: row.nominativo.trim(),
          prestazioni: []
        };
      }
      
      const giorno = row.giornoLavoro.toUpperCase().trim();
      const dataCalcolata = getDateForDay(giorno);
      
      if (dataCalcolata) {
        // Evita duplicati di data per lo stesso codice fiscale
        const giaPresente = groups[cf].prestazioni.some(p => p.data === dataCalcolata);
        if (!giaPresente) {
          groups[cf].prestazioni.push({
            giorno: giorno,
            data: dataCalcolata
          });
        }
      } else {
        righeNonRiconosciute.push(row);
      }
    });

    // Funzione helper per ordinare le date in formato DD/MM/YYYY
    const parseDateIT = (dStr: string) => {
      const parts = dStr.split('/');
      return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0])).getTime();
    };

    const elaborati: LavoratoreRaggruppato[] = Object.entries(groups).map(([cf, data]) => {
      // Ordina cronologicamente le prestazioni del lavoratore
      const ordPrestazioni = [...data.prestazioni].sort((a, b) => parseDateIT(a.data) - parseDateIT(b.data));
      return {
        codiceFiscale: cf,
        nominativo: data.nominativo,
        prestazioni: ordPrestazioni
      };
    });

    setLavoratoriElaborati(elaborati);
    setIsProcessed(true);
    
    // Pulisce l'anteprima corrente
    setPreviewPdfUrl(null);
    setSelectedLavoratorePreview(null);

    return righeNonRiconosciute;
  };

  // Avvisa l'utente delle righe scartate perché il giorno non è stato riconosciuto
  const avvisaRigheNonRiconosciute = (righe: InputRow[]) => {
    if (righe.length === 0) return;
    const elenco = righe
      .slice(0, 15)
      .map(r => `• ${r.nominativo} (${r.codiceFiscale}): "${r.giornoLavoro || 'vuoto'}"${r.rigaOriginale ? ` – riga ${r.rigaOriginale}` : ''}`)
      .join('\n');
    const altre = righe.length > 15 ? `\n…e altre ${righe.length - 15}` : '';
    alert(
      `Attenzione: ${righe.length} prestazioni NON sono state inserite perché il giorno non è stato riconosciuto ` +
      `(valori ammessi: LUN, MAR, MER, GIO, VEN, SAB, DOM).\n\n${elenco}${altre}\n\n` +
      `Correggi i dati di origine oppure aggiungi le prestazioni con "Modifica".`
    );
  };

  // Se cambia la settimana, ricalcola le date dei lavoratori già elaborati a partire dal giorno.
  // Si lavora sull'elenco corrente (non sulle righe grezze) per non perdere modifiche e rimozioni manuali.
  useEffect(() => {
    setLavoratoriElaborati(prev => prev.map(lav => ({
      ...lav,
      prestazioni: lav.prestazioni.map(p => ({ ...p, data: getDateForDay(p.giorno) }))
    })));
    handleClosePreview();
  }, [selectedDate]);

  // Aggiorna l'anteprima PDF in tempo reale per un lavoratore selezionato
  const handleShowPreview = async (lav: LavoratoreRaggruppato) => {
    setSelectedLavoratorePreview(lav);
    setIsPreviewLoading(true);
    try {
      const pdfBytes = await generateIntermittentePdf(employer, lav);
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      if (previewPdfUrl) {
        URL.revokeObjectURL(previewPdfUrl);
      }
      const url = URL.createObjectURL(blob);
      setPreviewPdfUrl(url);
    } catch (err) {
      console.error(err);
      alert("Errore nella generazione dell'anteprima del PDF.");
    } finally {
      setIsPreviewLoading(false);
    }
  };

  // Chiude l'anteprima rilasciando l'Object URL
  const handleClosePreview = () => {
    setSelectedLavoratorePreview(null);
    if (previewPdfUrl) {
      URL.revokeObjectURL(previewPdfUrl);
      setPreviewPdfUrl(null);
    }
  };

  // Download del PDF cumulativo unico (unione di tutte le pagine)
  const handleDownloadCombined = async () => {
    if (lavoratoriElaborati.length === 0) return;
    setIsGenerating(true);
    setProgress(20);
    try {
      setProgress(50);
      const combinedBytes = await generateCombinedIntermittentiPdf(employer, lavoratoriElaborati);
      setProgress(85);
      
      const blob = new Blob([combinedBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Comunicazioni_Intermittenti_Unico_${selectedDate}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      setProgress(100);
      setTimeout(() => {
        setIsGenerating(false);
        setProgress(0);
      }, 800);
    } catch (err) {
      console.error(err);
      alert("Si è verificato un errore durante la generazione del PDF unico.");
      setIsGenerating(false);
      setProgress(0);
    }
  };

  // Download dei PDF singoli compressi in un file ZIP
  const handleDownloadZip = async () => {
    if (lavoratoriElaborati.length === 0) return;
    setIsGenerating(true);
    setProgress(5);
    const zip = new JSZip();
    try {
      const total = lavoratoriElaborati.length;
      for (let i = 0; i < total; i++) {
        const lav = lavoratoriElaborati[i];
        const pdfBytes = await generateIntermittentePdf(employer, lav);
        
        // Pulisce il nome file
        const safeName = lav.nominativo.replace(/[^a-zA-Z0-9]/g, "_").toUpperCase();
        const fileName = `Comunicazione_Intermittente_${safeName}_${lav.codiceFiscale}.pdf`;
        zip.file(fileName, pdfBytes);
        
        const currentProg = Math.round(((i + 1) / total) * 80) + 5;
        setProgress(currentProg);
      }
      
      setProgress(90);
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Comunicazioni_Intermittenti_Singoli_${selectedDate}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      setProgress(100);
      setTimeout(() => {
        setIsGenerating(false);
        setProgress(0);
      }, 800);
    } catch (err) {
      console.error(err);
      alert("Si è verificato un errore durante la creazione dello ZIP.");
      setIsGenerating(false);
      setProgress(0);
    }
  };

  // Modifica rapida delle prestazioni di un lavoratore
  const startEditing = (lav: LavoratoreRaggruppato) => {
    // Cloniamo l'oggetto
    setEditingLavoratore(JSON.parse(JSON.stringify(lav)));
  };

  const handleSaveEdit = () => {
    if (!editingLavoratore) return;
    
    const updated = lavoratoriElaborati.map(l => {
      if (l.codiceFiscale === editingLavoratore.codiceFiscale) {
        return editingLavoratore;
      }
      return l;
    });
    
    setLavoratoriElaborati(updated);
    setEditingLavoratore(null);
  };

  const handleAddPrestazioneEdit = () => {
    if (!editingLavoratore) return;
    const primoGiornoNonIncluso = ['LUN', 'MAR', 'MER', 'GIO', 'VEN', 'SAB', 'DOM'].find(g => 
      !editingLavoratore.prestazioni.some(p => p.giorno === g)
    ) || 'LUN';
    
    const dataCalcolata = getDateForDay(primoGiornoNonIncluso);
    const nuovePrestazioni = [
      ...editingLavoratore.prestazioni,
      { giorno: primoGiornoNonIncluso, data: dataCalcolata }
    ];
    
    setEditingLavoratore({
      ...editingLavoratore,
      prestazioni: nuovePrestazioni
    });
  };

  const handleRemovePrestazioneEdit = (index: number) => {
    if (!editingLavoratore) return;
    const filtered = editingLavoratore.prestazioni.filter((_, idx) => idx !== index);
    setEditingLavoratore({
      ...editingLavoratore,
      prestazioni: filtered
    });
  };

  const handleChangeGiornoEdit = (index: number, nuovoGiorno: string) => {
    if (!editingLavoratore) return;
    const dataCalcolata = getDateForDay(nuovoGiorno);
    const updated = editingLavoratore.prestazioni.map((p, idx) => {
      if (idx === index) {
        return { giorno: nuovoGiorno, data: dataCalcolata };
      }
      return p;
    });
    
    setEditingLavoratore({
      ...editingLavoratore,
      prestazioni: updated
    });
  };

  // Rimozione di un lavoratore dall'elenco
  const handleRemoveLavoratore = (cf: string) => {
    if (window.confirm("Rimuovere questo lavoratore dall'elaborazione corrente?")) {
      const filtered = lavoratoriElaborati.filter(l => l.codiceFiscale !== cf);
      setLavoratoriElaborati(filtered);
      if (selectedLavoratorePreview?.codiceFiscale === cf) {
        handleClosePreview();
      }
    }
  };

  // Reset completo
  const handleReset = () => {
    if (window.confirm("Sei sicuro di voler pulire tutti i dati inseriti e ricominciare?")) {
      setPastedText('');
      setRawRows([]);
      setLavoratoriElaborati([]);
      setIsProcessed(false);
      handleClosePreview();
    }
  };

  // Salvataggio dell'elaborazione corrente nello storico
  const handleSaveToStorico = (titoloPersonalizzato?: string) => {
    if (lavoratoriElaborati.length === 0) return;
    
    const dataLunedioStr = weekDays[0].dateStr;
    const defaultTitle = `Settimana del ${dataLunedioStr} (${lavoratoriElaborati.length} dipendenti)`;
    const titoloEffettivo = (titoloPersonalizzato || currentSaveTitle || defaultTitle).trim();
    
    const nuovaElaborazione: ElaborazioneStorica = {
      id: `elab-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      titolo: titoloEffettivo,
      createdAt: new Date().toISOString(),
      selectedDate: selectedDate,
      employer: { ...employer },
      rawRows: [...rawRows],
      lavoratoriElaborati: [...lavoratoriElaborati],
      inputMethod: inputMethod,
      pastedText: pastedText
    };
    
    const nuovoStorico = [nuovaElaborazione, ...storico];
    setStorico(nuovoStorico);
    localStorage.setItem('interm_storico_elaborazioni', JSON.stringify(nuovoStorico));
    
    setShowSaveDialog(false);
    setCurrentSaveTitle('');
    alert(`Elaborazione "${titoloEffettivo}" salvata correttamente nello storico!`);
  };

  // Caricamento di un'elaborazione dallo storico
  const handleLoadFromStorico = (elab: ElaborazioneStorica) => {
    if (isProcessed && !window.confirm("Caricando questa elaborazione sovrascriverai i dati attualmente a schermo. Continuare?")) {
      return;
    }
    
    setEmployer(elab.employer);
    setSelectedDate(elab.selectedDate);
    setRawRows(elab.rawRows);
    setLavoratoriElaborati(elab.lavoratoriElaborati);
    setInputMethod(elab.inputMethod);
    setPastedText(elab.pastedText);
    setIsProcessed(true);
    
    // Pulisce l'anteprima
    handleClosePreview();
    
    // Scroll fluido verso i risultati
    setTimeout(() => {
      const target = document.getElementById('processed-results-section');
      if (target) {
        target.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
  };

  // Eliminazione di un'elaborazione dallo storico
  const handleRemoveFromStorico = (id: string, titolo: string) => {
    if (window.confirm(`Sei sicuro di voler eliminare l'elaborazione "${titolo}" dallo storico?`)) {
      const nuovoStorico = storico.filter(s => s.id !== id);
      setStorico(nuovoStorico);
      localStorage.setItem('interm_storico_elaborazioni', JSON.stringify(nuovoStorico));
    }
  };

  // Esportazione dello storico in formato JSON per backup
  const handleExportStorico = () => {
    try {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(storico, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `Backup_Storico_Intermittenti_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch (err) {
      console.error(err);
      alert("Si è verificato un errore nell'esportazione dello storico.");
    }
  };

  // Importazione dello storico da file JSON
  const handleImportStorico = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    if (e.target.files && e.target.files[0]) {
      fileReader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target?.result as string);
          if (Array.isArray(parsed)) {
            const isValid = parsed.every(item => item && typeof item === 'object' && 'id' in item && 'titolo' in item && 'lavoratoriElaborati' in item);
            if (!isValid) {
              alert("Il file caricato non sembra essere un file di backup dello storico valido.");
              return;
            }
            
            if (window.confirm(`Trovate ${parsed.length} elaborazioni nel file di backup. Vuoi unirle a quelle esistenti (OK) o sovrascrivere lo storico attuale (Annulla)?`)) {
              const esistentiMap = new Map<string, ElaborazioneStorica>(storico.map(s => [s.id, s]));
              (parsed as ElaborazioneStorica[]).forEach(item => esistentiMap.set(item.id, item));
              const unito = Array.from(esistentiMap.values()).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
              setStorico(unito);
              localStorage.setItem('interm_storico_elaborazioni', JSON.stringify(unito));
              alert("Storico importato con successo! Le elaborazioni sono state unite.");
            } else if (window.confirm("Sei sicuro di voler sovrascrivere interamente lo storico attuale con quello del file? Questa operazione non si può annullare.")) {
              setStorico(parsed as ElaborazioneStorica[]);
              localStorage.setItem('interm_storico_elaborazioni', JSON.stringify(parsed));
              alert("Storico sovrascritto con successo!");
            }
          } else {
            alert("Il formato del file non è corretto. Deve essere un file JSON contenente un array.");
          }
        } catch (err) {
          console.error(err);
          alert("Errore nella lettura del file. Assicurati che sia un file JSON valido generato da questo applicativo.");
        }
      };
      fileReader.readAsText(e.target.files[0]);
    }
  };

  if (!session) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col justify-between items-center p-4 sm:p-6 md:p-8 relative overflow-hidden" id="login-container">
        {/* Sfondo geometrico decorativo soft */}
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:16px_16px] opacity-70 pointer-events-none" />
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-100 rounded-full blur-3xl opacity-50 pointer-events-none" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-indigo-100 rounded-full blur-3xl opacity-50 pointer-events-none" />

        <div className="w-full max-w-lg my-auto relative z-10">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-3xl border border-slate-200/80 shadow-2xl p-6 sm:p-8 space-y-6"
          >
            {/* Logo e Titolo */}
            <div className="text-center space-y-3">
              <div className="inline-flex bg-blue-600 p-3.5 rounded-2xl text-white shadow-lg shadow-blue-600/20">
                <Lock className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                  Berti Food S.r.l.
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 font-semibold uppercase tracking-wider">
                  Portale Lavoratori Intermittenti
                </p>
              </div>
              <div className="h-px bg-slate-100 w-24 mx-auto" />
              <p className="text-xs text-slate-400 font-medium max-w-sm mx-auto leading-relaxed">
                Questo portale è riservato. Effettua l'accesso con Google per iniziare a compilare e gestire i contratti a chiamata.
              </p>
            </div>

            {/* Area Pulsante di Accesso */}
            <div className="space-y-4 pt-2">
              {/* Messaggio di Errore Whitelist / Auth */}
              {authError && (
                <div className="bg-red-50 border border-red-200/60 rounded-2xl p-4 flex gap-3 text-left">
                  <div className="text-red-600 shrink-0">
                    <ShieldAlert className="w-5 h-5 mt-0.5" />
                  </div>
                  <div className="space-y-1">
                    <div className="font-bold text-xs text-red-800 uppercase tracking-wider">
                      Accesso Negato
                    </div>
                    <p className="text-xs text-red-700 leading-relaxed">
                      {authError}
                    </p>
                  </div>
                </div>
              )}

              {/* Bottone Google Reale */}
              {customClientId ? (
                <div className="flex flex-col items-center justify-center space-y-2">
                  <div id="google-signin-button" className="min-h-[50px] flex items-center justify-center" />
                  <p className="text-[10px] text-slate-400 font-medium text-center">
                    Autenticazione sicura tramite Google OAuth 2.0
                  </p>
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

        {/* Footer */}
        <div className="w-full text-center py-4 text-[10px] text-slate-400 font-medium">
          &copy; 2026 Berti Food S.r.l. &bull; Tutti i diritti riservati &bull; Portale Gestione Contratti Intermittenti v1.4
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col justify-between" id="app-container">
      {/* HEADER PRINCIPALE */}
      <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-10" id="header-nav">
        <div className="max-w-7xl mx-auto px-4 py-3.5 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2.5 rounded-lg text-white shadow-md shadow-blue-600/10">
              <FileCheck className="w-6 h-6" id="header-icon-app" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight leading-none flex items-center gap-2">
                Compilatore Intermittenti
                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-medium border border-blue-200">
                  Modello Ministeriale
                </span>
              </h1>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Generatore automatico di Comunicazioni Obbligatorie a pacchetti di turni
              </p>
            </div>
          </div>
          
          {/* Informazioni Sessione Utente */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200/60 px-3 py-1.5 rounded-xl shadow-2xs">
              {session.picture ? (
                <img 
                  src={session.picture} 
                  alt={session.name} 
                  className="w-6 h-6 rounded-full border border-slate-200" 
                  referrerPolicy="no-referrer" 
                />
              ) : (
                <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs uppercase border border-blue-200">
                  {session.name.substring(0, 2)}
                </div>
              )}
              <div className="text-left leading-none hidden sm:block">
                <span className="block text-xs font-bold text-slate-800">{session.name}</span>
                <span className="text-[9px] font-mono text-slate-400">{session.email}</span>
              </div>
            </div>
            <button
              onClick={() => setShowSignOutConfirm(true)}
              className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all cursor-pointer border-none"
              title="Disconnetti"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>


      {/* CONTENUTO PRINCIPALE */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full space-y-8" id="main-content-section">
        {/* ROW 1: CONFIGURAZIONE DATORE E SETTIMANA */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8" id="configuration-row">
          {/* DATI DATORE DI LAVORO */}
          <div className="lg:col-span-6 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Building2 className="w-5 h-5 text-blue-600" />
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                1. Dati Datore di Lavoro (Azienda)
              </h2>
            </div>
            <p className="text-xs text-slate-500">
              I dati che verranno impressi in testa ad ogni singolo modulo PDF generato.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">CODICE FISCALE *</label>
                <input
                  type="text"
                  value={employer.codiceFiscale}
                  onChange={(e) => setEmployer({ ...employer, codiceFiscale: e.target.value })}
                  placeholder="Inserisci CF azienda"
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">E-MAIL *</label>
                <input
                  type="email"
                  value={employer.email}
                  onChange={(e) => setEmployer({ ...employer, email: e.target.value })}
                  placeholder="Inserisci e-mail azienda"
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono"
                />
              </div>
            </div>
          </div>

          {/* SETTIMANA DI RIFERIMENTO */}
          <div className="lg:col-span-6 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <CalendarDays className="w-5 h-5 text-blue-600" />
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                2. Settimana di Riferimento
              </h2>
            </div>
            <p className="text-xs text-slate-500">
              Seleziona un giorno qualsiasi per identificare la settimana. Il sistema calcolerà le date esatte.
            </p>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="w-full sm:w-auto">
                <label className="block text-xs font-bold text-slate-600 mb-1.5">DATA DI RIFERIMENTO</label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => {
                    // Calcola il lunedì di quella data (ignora il campo svuotato)
                    if (!e.target.value) return;
                    setSelectedDate(getMondayISO(parseISODateLocal(e.target.value)));
                  }}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono"
                />
              </div>
              <div className="flex-1">
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Mappatura Date Settimana Calcolata
                </span>
                <div className="grid grid-cols-7 gap-1 bg-slate-50 p-2 rounded-lg border border-slate-100">
                  {weekDays.map((wd) => (
                    <div key={wd.name} className="text-center">
                      <span className="block text-[9px] font-extrabold text-blue-600 leading-none">{wd.name}</span>
                      <span className="block text-[10px] font-mono text-slate-600 mt-1 font-bold leading-none">{wd.formattedShort}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ARCHIVIO STORICO */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden" id="historical-archive-section">
          <button
            onClick={() => setIsStoricoExpanded(!isStoricoExpanded)}
            className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50/50 transition-all cursor-pointer text-left focus:outline-none"
          >
            <div className="flex items-center gap-2.5">
              <div className="bg-slate-100 p-2 rounded-xl text-slate-600">
                <History className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  Archivio Storico Elaborazioni
                  <span className="text-xs bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full font-bold border border-slate-200 font-mono">
                    {storico.length} salvataggi
                  </span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5 font-medium">
                  Recupera, scarica o cancella le settimane elaborate precedentemente
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg">
                {isStoricoExpanded ? 'Comprimi ▴' : 'Espandi ▾'}
              </span>
            </div>
          </button>

          <AnimatePresence>
            {isStoricoExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="border-t border-slate-100 overflow-hidden"
              >
                <div className="p-6 space-y-4">
                  {/* Azioni globali sullo storico */}
                  <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <span className="text-xs font-medium text-slate-500">
                      I dati sono salvati localmente in modo sicuro e riservato nel browser dell'utente.
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleExportStorico}
                        disabled={storico.length === 0}
                        className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                      >
                        <FileDown className="w-3.5 h-3.5 text-slate-500" />
                        Esporta Backup JSON
                      </button>
                      <label className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs">
                        <FileUp className="w-3.5 h-3.5 text-slate-500" />
                        Importa Backup JSON
                        <input
                          type="file"
                          accept=".json"
                          onChange={handleImportStorico}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>

                  {/* Lista elaborazioni */}
                  <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden bg-white max-h-[350px] overflow-y-auto">
                    {storico.length === 0 ? (
                      <div className="p-10 text-center text-slate-400 space-y-2">
                        <Archive className="w-8 h-8 mx-auto text-slate-300" />
                        <p className="text-xs font-bold text-slate-500">Nessuna elaborazione salvata nello storico</p>
                        <p className="text-[11px] leading-relaxed max-w-sm mx-auto">
                          Una volta inseriti i dipendenti di una settimana e completata l'elaborazione, potrai salvarla qui per recuperarla quando vuoi.
                        </p>
                      </div>
                    ) : (
                      storico.map((item) => {
                        const monday = parseISODateLocal(getMondayISO(parseISODateLocal(item.selectedDate)));
                        const dd = String(monday.getDate()).padStart(2, '0');
                        const mm = String(monday.getMonth() + 1).padStart(2, '0');
                        const formattedMonday = `${dd}/${mm}/${monday.getFullYear()}`;
                        
                        return (
                          <div key={item.id} className="p-4 hover:bg-slate-50/50 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="space-y-1">
                              <h4 className="text-sm font-bold text-slate-800">
                                {item.titolo}
                              </h4>
                              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-400 font-medium">
                                <span className="text-blue-600 font-bold bg-blue-50 px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider">
                                  {item.lavoratoriElaborati.length} lavoratori
                                </span>
                                <span>•</span>
                                <span className="font-mono">Settimana del {formattedMonday}</span>
                                <span>•</span>
                                <span>Azienda: <strong className="text-slate-500">{item.employer.codiceFiscale}</strong></span>
                                <span>•</span>
                                <span>Salvato il: {new Date(item.createdAt).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' })}</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 self-end sm:self-center">
                              <button
                                onClick={() => handleLoadFromStorico(item)}
                                className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
                                title="Carica a schermo"
                              >
                                <FolderOpen className="w-3.5 h-3.5" />
                                Ripristina
                              </button>
                              
                              <button
                                onClick={async () => {
                                  try {
                                    const combinedBytes = await generateCombinedIntermittentiPdf(item.employer, item.lavoratoriElaborati);
                                    const blob = new Blob([combinedBytes], { type: 'application/pdf' });
                                    const url = URL.createObjectURL(blob);
                                    const link = document.createElement('a');
                                    link.href = url;
                                    link.download = `Comunicazioni_Intermittenti_Unico_${item.selectedDate}.pdf`;
                                    document.body.appendChild(link);
                                    link.click();
                                    document.body.removeChild(link);
                                    URL.revokeObjectURL(url);
                                  } catch (err) {
                                    console.error(err);
                                    alert("Errore durante il download del PDF");
                                  }
                                }}
                                className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold"
                                title="Scarica PDF unico direttamente"
                              >
                                <FileText className="w-3.5 h-3.5" />
                              </button>

                              <button
                                onClick={() => handleRemoveFromStorico(item.id, item.titolo)}
                                className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs font-bold"
                                title="Elimina dallo storico"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ROW 2: INPUT DATI EXCEL */}
        {!isProcessed && (
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
            id="data-input-box"
          >
            {/* SELETTORE METODO */}
            <div className="flex border-b border-slate-100 bg-slate-50/50">
              <button
                onClick={() => setInputMethod('paste')}
                className={`flex-1 py-4 text-center text-sm font-bold flex items-center justify-center gap-2 border-b-2 transition-all ${
                  inputMethod === 'paste' 
                    ? 'border-blue-600 text-blue-600 bg-white' 
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Edit2 className="w-4 h-4" />
                Incolla Copia-Incolla da Excel
              </button>
              <button
                onClick={() => setInputMethod('upload')}
                className={`flex-1 py-4 text-center text-sm font-bold flex items-center justify-center gap-2 border-b-2 transition-all ${
                  inputMethod === 'upload' 
                    ? 'border-blue-600 text-blue-600 bg-white' 
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <UploadCloud className="w-4 h-4" />
                Carica File Excel (.xlsx / .xls)
              </button>
            </div>

            <div className="p-6">
              {inputMethod === 'paste' ? (
                <div className="space-y-4">
                  <div className="flex items-start gap-3 bg-blue-50/50 p-4 rounded-xl border border-blue-100 text-blue-900">
                    <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                    <div className="text-xs leading-relaxed">
                      <p className="font-bold">Istruzioni per l'inserimento rapido:</p>
                      <p className="mt-1 text-blue-800">
                        In Excel seleziona e copia 3 colonne: <strong>CODICE FISCALE</strong>, <strong>NOME E COGNOME</strong>, e <strong>GIORNO DI LAVORO</strong> (es. SAB, DOM, LUN). Incolla il testo direttamente nell'area sottostante e premi "Elabora". Ciascuna riga deve rappresentare una singola prestazione.
                      </p>
                    </div>
                  </div>

                  <textarea
                    rows={8}
                    value={pastedText}
                    onChange={(e) => setPastedText(e.target.value)}
                    placeholder="Incolla qui i dati da Excel...&#10;Esempio:&#10;RSSMRA80A01F205X	MARIO ROSSI	SAB&#10;RSSMRA80A01F205X	MARIO ROSSI	DOM&#10;BNCHRA85B41F205Y	LAURA BIANCHI	DOM"
                    className="w-full p-4 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />

                  <div className="flex justify-end">
                    <button
                      onClick={handleElaboraPaste}
                      className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-md shadow-blue-600/15 flex items-center gap-2 transition-all cursor-pointer active:scale-98"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Elabora e Raggruppa
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div
                    onDragEnter={handleDrag}
                    onDragOver={handleDrag}
                    onDragLeave={handleDrag}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${
                      dragActive 
                        ? 'border-blue-500 bg-blue-50/20' 
                        : 'border-slate-300 hover:border-slate-400 bg-slate-50/50'
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx, .xls, .csv"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <FileSpreadsheet className="w-12 h-12 text-blue-500 mx-auto mb-4" />
                    <p className="text-sm font-bold text-slate-700">Trascina qui il file Excel o clicca per sfogliare</p>
                    <p className="text-xs text-slate-400 mt-1">Supporta formati .xlsx, .xls, .csv</p>
                    <div className="mt-4 inline-flex items-center gap-1.5 text-xs bg-white px-3 py-1.5 rounded-full border border-slate-200 text-slate-500 font-medium">
                      <Info className="w-3.5 h-3.5 text-blue-500" />
                      Colonne lette nell'ordine: C.F. / Nominativo / Giorno di lavoro
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* ROW 3: RISULTATI ELABORATI */}
        {isProcessed && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-6"
            id="processed-results-section"
          >
            {/* BARRA AZIONI SUPERIORE */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="bg-emerald-100 p-2.5 rounded-xl text-emerald-700">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">
                    Elaborazione Completata Con Successo
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Trovati <strong>{lavoratoriElaborati.length} lavoratori</strong> distinti con turni attivi nella settimana selezionata.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  onClick={handleDownloadCombined}
                  disabled={isGenerating || lavoratoriElaborati.length === 0}
                  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <FileText className="w-4 h-4" />
                  Scarica PDF Unico (Tutti)
                </button>
                <button
                  onClick={handleDownloadZip}
                  disabled={isGenerating || lavoratoriElaborati.length === 0}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  Scarica ZIP (Moduli Singoli)
                </button>
                <button
                  onClick={() => {
                    const dataLunedioStr = weekDays[0].dateStr;
                    setCurrentSaveTitle(`Settimana del ${dataLunedioStr} (${lavoratoriElaborati.length} dipendenti)`);
                    setShowSaveDialog(true);
                  }}
                  className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  Salva in Archivio
                </button>
                <button
                  onClick={handleReset}
                  className="px-4 py-2.5 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  Pulisci e Riavvia
                </button>
              </div>
            </div>

            {/* BARRA PROGRESSO GENERAZIONE */}
            {isGenerating && (
              <div className="bg-white p-4 rounded-xl border border-blue-100 shadow-xs space-y-2 animate-pulse">
                <div className="flex items-center justify-between text-xs font-bold text-blue-700">
                  <span className="flex items-center gap-1">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Generazione moduli PDF in corso...
                  </span>
                  <span>{progress}%</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div className="bg-blue-600 h-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
              {/* ELENCO LAVORATORI ELABORATI (TABELLA) */}
              <div className="xl:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Lavoratori & Servizi Abbinati
                  </span>
                  <span className="text-xs font-semibold bg-blue-100 text-blue-800 px-2.5 py-0.5 rounded-full">
                    {lavoratoriElaborati.length} record
                  </span>
                </div>

                <div className="divide-y divide-slate-100 overflow-y-auto max-h-[550px]">
                  {lavoratoriElaborati.map((lav) => {
                    const isSelectedPreview = selectedLavoratorePreview?.codiceFiscale === lav.codiceFiscale;
                    return (
                      <div
                        key={lav.codiceFiscale}
                        className={`p-4 transition-all hover:bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                          isSelectedPreview ? 'bg-blue-50/30 border-l-4 border-blue-500 pl-3' : ''
                        }`}
                      >
                        <div className="space-y-1">
                          <h4 className="text-sm font-bold text-slate-900 uppercase">
                            {lav.nominativo}
                          </h4>
                          <div className="flex items-center gap-2 font-mono text-xs text-slate-500">
                            <span>{lav.codiceFiscale}</span>
                            <span className="text-slate-300">•</span>
                            <span className="text-blue-600 font-bold bg-blue-50 px-1.5 py-0.5 rounded">
                              {lav.prestazioni.length} giornate
                            </span>
                          </div>
                          
                          {/* Elenco dei giorni in cui lavora */}
                          <div className="flex flex-wrap items-center gap-2 pt-1.5">
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Giornate:</span>
                            <div className="flex flex-wrap gap-1">
                              {lav.prestazioni.map((p, idx) => (
                                <span
                                  key={idx}
                                  className="inline-flex items-center gap-1 text-[10px] font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200/60 font-mono"
                                >
                                  {p.giorno} {p.data.substring(0, 5)}
                                </span>
                              ))}
                            </div>
                          </div>

                          {/* Periodi raggruppati consecutivi */}
                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            <span className="text-[10px] text-blue-500 font-bold uppercase tracking-wider">Nel PDF (giorni consecutivi uniti):</span>
                            <div className="flex flex-wrap gap-1">
                              {getIntervalliLavorativi(lav.prestazioni).map((interv, idx) => (
                                <span
                                  key={idx}
                                  className="inline-flex items-center gap-1 text-[10px] font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200 font-mono"
                                >
                                  {interv.dataInizio === interv.dataFine 
                                    ? interv.dataInizio.substring(0, 5) 
                                    : `${interv.dataInizio.substring(0, 5)} ➔ ${interv.dataFine.substring(0, 5)} (${interv.giorni.join('-')})`
                                  }
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Pulsanti azioni lavoratore */}
                        <div className="flex items-center gap-1.5 self-end sm:self-center">
                          <button
                            onClick={() => handleShowPreview(lav)}
                            className="p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
                            title="Mostra Anteprima PDF"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Anteprima
                          </button>
                          <button
                            onClick={() => startEditing(lav)}
                            className="p-1.5 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
                            title="Modifica Turni"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            Modifica
                          </button>
                          <button
                            onClick={() => handleRemoveLavoratore(lav.codiceFiscale)}
                            className="p-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
                            title="Rimuovi"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Rimuovi
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  
                  {lavoratoriElaborati.length === 0 && (
                    <div className="p-8 text-center text-slate-400 text-sm">
                      Nessun lavoratore nell'elenco. Premi "Pulisci e Riavvia" per caricare nuovi dati.
                    </div>
                  )}
                </div>
              </div>

              {/* PANNELLO DI DETTAGLIO O ANTEPRIMA PDF IN TEMPO REALE */}
              <div className="xl:col-span-5 flex flex-col space-y-6">
                {/* MODAL EDITING RAPIDO */}
                {editingLavoratore && (
                  <div className="bg-amber-50/50 p-5 rounded-2xl border border-amber-200 shadow-sm space-y-4">
                    <div className="flex items-center justify-between border-b border-amber-200 pb-2">
                      <span className="text-xs font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1">
                        <Edit2 className="w-3.5 h-3.5" />
                        Modifica rapida turni
                      </span>
                      <button
                        onClick={() => setEditingLavoratore(null)}
                        className="text-xs font-bold text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        Annulla
                      </button>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase">Nominativo</label>
                        <input
                          type="text"
                          value={editingLavoratore.nominativo}
                          onChange={(e) => setEditingLavoratore({ ...editingLavoratore, nominativo: e.target.value })}
                          className="w-full mt-1 px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 uppercase font-bold text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase font-mono">Codice Fiscale</label>
                        <input
                          type="text"
                          value={editingLavoratore.codiceFiscale}
                          onChange={(e) => setEditingLavoratore({ ...editingLavoratore, codiceFiscale: e.target.value })}
                          className="w-full mt-1 px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono uppercase"
                        />
                      </div>

                      <div className="space-y-2 pt-1">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase">
                          Giornate di Prestazione (Max 10 per foglio)
                        </label>
                        
                        <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                          {editingLavoratore.prestazioni.map((p, idx) => (
                            <div key={idx} className="flex items-center gap-2 bg-white p-2 rounded-lg border border-slate-100">
                              <select
                                value={p.giorno}
                                onChange={(e) => handleChangeGiornoEdit(idx, e.target.value)}
                                className="bg-slate-50 border border-slate-200 rounded text-xs px-2 py-1 font-bold text-blue-600"
                              >
                                {['LUN', 'MAR', 'MER', 'GIO', 'VEN', 'SAB', 'DOM'].map(g => (
                                  <option key={g} value={g}>{g}</option>
                                ))}
                              </select>
                              <span className="text-xs font-mono text-slate-500 flex-1">{p.data}</span>
                              <button
                                onClick={() => handleRemovePrestazioneEdit(idx)}
                                className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded"
                                title="Rimuovi prestazione"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>

                        <div className="flex gap-2 pt-1">
                          <button
                            onClick={handleAddPrestazioneEdit}
                            disabled={editingLavoratore.prestazioni.length >= 10}
                            className="flex-1 py-1.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-600 rounded-lg text-xs font-bold transition-all"
                          >
                            + Aggiungi Giorno
                          </button>
                          <button
                            onClick={handleSaveEdit}
                            className="flex-1 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 shadow-sm"
                          >
                            <Check className="w-3.5 h-3.5" />
                            Salva modifiche
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ANTEPRIMA PDF COMPILATO */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex-1 flex flex-col min-h-[350px]">
                  <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                      <FileText className="w-4 h-4 text-blue-500" />
                      Anteprima Modulo PDF Ministeriale
                    </span>
                    {selectedLavoratorePreview && (
                      <button
                        onClick={handleClosePreview}
                        className="text-xs text-slate-400 hover:text-slate-600 font-bold transition-all"
                      >
                        Chiudi
                      </button>
                    )}
                  </div>

                  <div className="flex-1 bg-slate-100 flex items-center justify-center relative min-h-[350px]">
                    {isPreviewLoading && (
                      <div className="absolute inset-0 bg-white/85 flex flex-col items-center justify-center z-10 gap-2">
                        <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
                        <span className="text-xs font-bold text-slate-600">Generazione anteprima in corso...</span>
                      </div>
                    )}

                    {previewPdfUrl ? (
                      <iframe
                        src={`${previewPdfUrl}#toolbar=0&navpanes=0&scrollbar=0`}
                        className="w-full h-full border-none min-h-[400px]"
                        title="Anteprima PDF"
                      />
                    ) : (
                      <div className="text-center p-8 text-slate-400 max-w-xs space-y-3">
                        <div className="bg-slate-200 p-3 rounded-full w-fit mx-auto text-slate-500">
                          <Eye className="w-6 h-6" />
                        </div>
                        <p className="text-xs font-bold text-slate-600">Nessuna anteprima attiva</p>
                        <p className="text-[11px] leading-relaxed">
                          Clicca sul tasto <strong>"Anteprima"</strong> accanto a un dipendente nella lista per vedere come apparirà il suo modulo ministeriale pronto.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </main>

      {/* FOOTER */}
      <footer className="bg-white border-t border-slate-200 py-6 mt-16" id="footer-section">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-xs text-slate-400 space-y-2">
          <p>© 2026 Berti Food S.r.l. • Compilatore automatico Comunicazioni Obbligatorie Intermittenti.</p>
          <p>
            Questo applicativo opera interamente all'interno del tuo browser. Nessun dato personale o aziendale viene salvato su database esterni o inviato a server terzi, garantendo la totale conformità e riservatezza dei dati.
          </p>
        </div>
      </footer>

      {/* DIALOG SALVATAGGIO STORICO */}
      <AnimatePresence>
        {showSaveDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" id="save-historical-dialog">
            {/* Sfondo semitrasparente */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setShowSaveDialog(false);
                setCurrentSaveTitle('');
              }}
              className="absolute inset-0 bg-slate-900/45 backdrop-blur-[2px]"
            />
            
            {/* Finestra di dialogo */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 relative z-10 space-y-4"
            >
              <div className="flex items-center gap-2 text-blue-600 border-b border-slate-100 pb-3">
                <Save className="w-5 h-5" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">
                  Salva nello Storico
                </h3>
              </div>

              <p className="text-xs text-slate-500 leading-relaxed">
                Assegna un nome identificativo a questa elaborazione per poterla rintracciare e ricaricare facilmente in futuro.
              </p>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-slate-500 uppercase">Titolo Elaborazione</label>
                <input
                  type="text"
                  value={currentSaveTitle}
                  onChange={(e) => setCurrentSaveTitle(e.target.value)}
                  placeholder={`es. Settimana del ${weekDays[0].dateStr}`}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium text-slate-800"
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  onClick={() => {
                    setShowSaveDialog(false);
                    setCurrentSaveTitle('');
                  }}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-lg transition-all cursor-pointer"
                >
                  Annulla
                </button>
                <button
                  onClick={() => handleSaveToStorico()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-sm transition-all cursor-pointer"
                >
                  Conferma e Salva
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DIALOG CONFERMA DISCONNESSIONE */}
      <AnimatePresence>
        {showSignOutConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" id="signout-confirmation-dialog">
            {/* Sfondo semitrasparente */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSignOutConfirm(false)}
              className="absolute inset-0 bg-slate-900/45 backdrop-blur-[2px]"
            />
            
            {/* Finestra di dialogo */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-sm w-full p-6 relative z-10 space-y-4"
            >
              <div className="flex items-center gap-2 text-red-600 border-b border-slate-100 pb-3">
                <LogOut className="w-5 h-5" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">
                  Disconnessione
                </h3>
              </div>

              <p className="text-xs text-slate-500 leading-relaxed">
                Sei sicuro di voler effettuare la disconnessione? Dovrai autenticarti nuovamente con Google per accedere al portale.
              </p>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  onClick={() => setShowSignOutConfirm(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-lg transition-all cursor-pointer"
                >
                  Annulla
                </button>
                <button
                  onClick={handleSignOut}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold shadow-sm transition-all cursor-pointer"
                >
                  Sì, Disconnetti
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
