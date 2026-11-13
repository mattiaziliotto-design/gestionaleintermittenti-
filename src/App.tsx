import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Building2, CalendarDays, CheckCircle2, Download, FileCheck, FileText, LogOut, RefreshCw, RotateCcw, Save,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { ElaborazioneStorica, EmployerConfig, InputRow, LavoratoreRaggruppato, UserSession } from './types';
import { restoreSession } from './utils/auth';
import { isCodiceFiscaleValido } from './utils/codiceFiscale';
import { formatDateIT, getMondayISO, getWeekDays, parseISODateLocal } from './utils/dates';
import { downloadBlob, safeFileName } from './utils/download';
import { parsePastedData, parseSheetRows, raggruppaLavoratori, riallineaPrestazioni } from './utils/parsing';
import { clearSession, loadEmployer, loadStorico, sanitizeStorico, saveEmployer, saveSession, saveStorico } from './utils/storage';
import DataInput from './components/DataInput';
import EditPanel from './components/EditPanel';
import LoginScreen from './components/LoginScreen';
import Modal from './components/Modal';
import PreviewPanel from './components/PreviewPanel';
import StoricoPanel from './components/StoricoPanel';
import WorkerList from './components/WorkerList';

// Le librerie pesanti (PDF, ZIP, Excel) vengono scaricate solo al primo utilizzo
const loadPdfGenerator = () => import('./utils/pdfGenerator');

const inputClass =
  'w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono';
const SPAZIO_ESAURITO =
  'Salvataggio non riuscito: lo spazio del browser potrebbe essere esaurito. Esporta un backup ed elimina le elaborazioni più vecchie.';

export default function App() {
  const [session, setSession] = useState<UserSession | null>(() => restoreSession());
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);

  const [employer, setEmployer] = useState<EmployerConfig>(loadEmployer);
  // Lunedì della settimana di riferimento (YYYY-MM-DD)
  const [selectedDate, setSelectedDate] = useState<string>(() => getMondayISO(new Date()));

  const [inputMethod, setInputMethod] = useState<'paste' | 'upload'>('paste');
  const [pastedText, setPastedText] = useState('');
  const [rawRows, setRawRows] = useState<InputRow[]>([]);
  const [lavoratori, setLavoratori] = useState<LavoratoreRaggruppato[]>([]);
  const [isProcessed, setIsProcessed] = useState(false);

  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);

  // Anteprima PDF: codice fiscale del lavoratore mostrato e Object URL del documento
  const [preview, setPreview] = useState<{ cf: string; url: string | null } | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const previewRequest = useRef(0);

  // Modifica rapida: bozza del lavoratore e codice fiscale con cui era in elenco
  const [editing, setEditing] = useState<{ originalCf: string; draft: LavoratoreRaggruppato } | null>(null);

  const [storico, setStorico] = useState<ElaborazioneStorica[]>(loadStorico);
  const [saveTitle, setSaveTitle] = useState<string | null>(null);

  const weekDays = getWeekDays(selectedDate);

  useEffect(() => {
    saveEmployer(employer);
  }, [employer]);

  // Rilascia l'Object URL dell'anteprima quando viene sostituito o chiuso
  const previewUrl = preview?.url ?? null;
  useEffect(() => {
    if (!previewUrl) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const handleLogin = useCallback((newSession: UserSession) => {
    saveSession(newSession);
    setSession(newSession);
  }, []);

  const handleSignOut = () => {
    clearSession();
    setSession(null);
    setShowSignOutConfirm(false);
  };

  // --- ANTEPRIMA ---

  const closePreview = () => {
    previewRequest.current++;
    setPreview(null);
    setIsPreviewLoading(false);
  };

  const showPreview = async (lav: LavoratoreRaggruppato) => {
    // Se nel frattempo viene richiesta un'altra anteprima, questa viene scartata
    const request = ++previewRequest.current;
    setPreview({ cf: lav.codiceFiscale, url: null });
    setIsPreviewLoading(true);
    try {
      const { generateIntermittentePdf } = await loadPdfGenerator();
      const pdfBytes = await generateIntermittentePdf(employer, lav);
      if (request !== previewRequest.current) return;
      const url = URL.createObjectURL(new Blob([pdfBytes as BlobPart], { type: 'application/pdf' }));
      setPreview({ cf: lav.codiceFiscale, url });
    } catch (err) {
      console.error(err);
      if (request !== previewRequest.current) return;
      setPreview(null);
      alert("Errore nella generazione dell'anteprima del PDF.");
    } finally {
      if (request === previewRequest.current) setIsPreviewLoading(false);
    }
  };

  // --- ELABORAZIONE DEI DATI ---

  const elabora = (rows: InputRow[]) => {
    const { lavoratori: elaborati, righeNonRiconosciute } = raggruppaLavoratori(rows, selectedDate);
    setRawRows(rows);
    setLavoratori(elaborati);
    setIsProcessed(true);
    setEditing(null);
    closePreview();

    const avvisi: string[] = [];
    if (righeNonRiconosciute.length > 0) {
      const elenco = righeNonRiconosciute
        .slice(0, 15)
        .map(r => `• ${r.nominativo} (${r.codiceFiscale}): "${r.giornoLavoro || 'vuoto'}"${r.rigaOriginale ? ` – riga ${r.rigaOriginale}` : ''}`)
        .join('\n');
      const altre = righeNonRiconosciute.length > 15 ? `\n…e altre ${righeNonRiconosciute.length - 15}` : '';
      avvisi.push(
        `${righeNonRiconosciute.length} prestazioni NON sono state inserite perché il giorno non è stato riconosciuto ` +
        `(valori ammessi: LUN, MAR, MER, GIO, VEN, SAB, DOM).\n\n${elenco}${altre}\n\n` +
        `Correggi i dati di origine oppure aggiungi le prestazioni con "Modifica". ` +
        `I lavoratori senza alcuna giornata valida non compaiono in elenco.`
      );
    }
    const cfDubbi = elaborati.filter(l => !isCodiceFiscaleValido(l.codiceFiscale));
    if (cfDubbi.length > 0) {
      avvisi.push(
        `${cfDubbi.length} codici fiscali non superano il controllo formale e sono segnalati in elenco:\n\n` +
        cfDubbi.slice(0, 15).map(l => `• ${l.nominativo} (${l.codiceFiscale})`).join('\n')
      );
    }
    if (avvisi.length > 0) alert(`Attenzione:\n\n${avvisi.join('\n\n')}`);
  };

  const handleElaboraPaste = () => {
    if (!pastedText.trim()) {
      alert("Incolla prima dei dati dall'Excel nell'area di testo!");
      return;
    }
    const rows = parsePastedData(pastedText);
    if (rows.length === 0) {
      alert('Nessun dato valido individuato. Controlla il formato (colonna 1: Codice Fiscale, colonna 2: Nome e Cognome, colonna 3: Giorno di lavoro).');
      return;
    }
    elabora(rows);
  };

  const handleFile = async (file: File) => {
    try {
      const XLSX = await import('xlsx');
      const workbook = XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: 'array' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = parseSheetRows(XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as unknown[][]);
      if (rows.length === 0) {
        alert('Nessuna riga valida trovata nel file Excel. Assicurati che le colonne contengano Codice Fiscale, Nome/Cognome e Giorno di Lavoro.');
        return;
      }
      elabora(rows);
    } catch (err) {
      console.error(err);
      alert('Errore nel leggere il file Excel. Assicurati che sia un file .xlsx, .xls o .csv valido.');
    }
  };

  // Al cambio settimana le date vengono ricalcolate sull'elenco corrente (e sulla bozza in modifica),
  // senza ripartire dalle righe grezze per non perdere modifiche e rimozioni manuali
  const handleWeekChange = (value: string) => {
    if (!value) return; // campo svuotato
    const monday = getMondayISO(parseISODateLocal(value));
    if (monday === selectedDate) return;
    setSelectedDate(monday);
    setLavoratori(prev => prev.map(lav => riallineaPrestazioni(lav, monday)));
    setEditing(prev => prev && { ...prev, draft: riallineaPrestazioni(prev.draft, monday) });
    closePreview();
  };

  // --- DOWNLOAD ---

  const runGeneration = async (errorMessage: string, task: () => Promise<void>) => {
    setIsGenerating(true);
    setProgress(5);
    try {
      await task();
      setProgress(100);
      await new Promise(resolve => setTimeout(resolve, 800));
    } catch (err) {
      console.error(err);
      alert(errorMessage);
    } finally {
      setIsGenerating(false);
      setProgress(0);
    }
  };

  const handleDownloadCombined = () =>
    runGeneration('Si è verificato un errore durante la generazione del PDF unico.', async () => {
      const { generateCombinedIntermittentiPdf } = await loadPdfGenerator();
      setProgress(50);
      const bytes = await generateCombinedIntermittentiPdf(employer, lavoratori);
      downloadBlob(bytes, `Comunicazioni_Intermittenti_Unico_${selectedDate}.pdf`, 'application/pdf');
    });

  const handleDownloadZip = () =>
    runGeneration('Si è verificato un errore durante la creazione dello ZIP.', async () => {
      const [{ generateIntermittentePdf }, { default: JSZip }] = await Promise.all([loadPdfGenerator(), import('jszip')]);
      const zip = new JSZip();
      for (let i = 0; i < lavoratori.length; i++) {
        const lav = lavoratori[i];
        const fileName = `Comunicazione_Intermittente_${safeFileName(lav.nominativo)}_${safeFileName(lav.codiceFiscale)}.pdf`;
        zip.file(fileName, await generateIntermittentePdf(employer, lav));
        setProgress(5 + Math.round(((i + 1) / lavoratori.length) * 80));
      }
      downloadBlob(await zip.generateAsync({ type: 'blob' }), `Comunicazioni_Intermittenti_Singoli_${selectedDate}.zip`, 'application/zip');
    });

  const handleDownloadStoricoPdf = async (elab: ElaborazioneStorica) => {
    try {
      const { generateCombinedIntermittentiPdf } = await loadPdfGenerator();
      const bytes = await generateCombinedIntermittentiPdf(elab.employer, elab.lavoratoriElaborati);
      downloadBlob(bytes, `Comunicazioni_Intermittenti_Unico_${elab.selectedDate}.pdf`, 'application/pdf');
    } catch (err) {
      console.error(err);
      alert('Errore durante il download del PDF');
    }
  };

  // --- MODIFICA DEI LAVORATORI ---

  const startEditing = (lav: LavoratoreRaggruppato) => {
    setEditing({ originalCf: lav.codiceFiscale, draft: riallineaPrestazioni(lav, selectedDate) });
  };

  const handleSaveEdit = () => {
    if (!editing) return;
    const codiceFiscale = editing.draft.codiceFiscale.toUpperCase().replace(/\s+/g, '');
    const nominativo = editing.draft.nominativo.trim();
    if (!codiceFiscale || !nominativo) {
      alert('Nominativo e codice fiscale sono obbligatori.');
      return;
    }
    if (codiceFiscale !== editing.originalCf && lavoratori.some(l => l.codiceFiscale === codiceFiscale)) {
      alert(`Il codice fiscale ${codiceFiscale} appartiene già a un altro lavoratore in elenco.`);
      return;
    }
    if (!isCodiceFiscaleValido(codiceFiscale) && !window.confirm(`Il codice fiscale ${codiceFiscale} non supera il controllo formale. Salvare comunque?`)) {
      return;
    }

    const aggiornato = riallineaPrestazioni({ ...editing.draft, codiceFiscale, nominativo }, selectedDate);
    setLavoratori(prev => prev.map(l => (l.codiceFiscale === editing.originalCf ? aggiornato : l)));
    setEditing(null);
    // L'anteprima aperta sul lavoratore modificato viene rigenerata con i nuovi dati
    if (preview?.cf === editing.originalCf) showPreview(aggiornato);
  };

  const handleRemoveLavoratore = (lav: LavoratoreRaggruppato) => {
    if (!window.confirm(`Rimuovere ${lav.nominativo} dall'elaborazione corrente?`)) return;
    setLavoratori(prev => prev.filter(l => l.codiceFiscale !== lav.codiceFiscale));
    if (preview?.cf === lav.codiceFiscale) closePreview();
    if (editing?.originalCf === lav.codiceFiscale) setEditing(null);
  };

  const handleReset = () => {
    if (!window.confirm('Sei sicuro di voler pulire tutti i dati inseriti e ricominciare?')) return;
    setPastedText('');
    setRawRows([]);
    setLavoratori([]);
    setIsProcessed(false);
    setEditing(null);
    closePreview();
  };

  // --- ARCHIVIO STORICO ---

  // Aggiorna lo storico solo se il salvataggio nel browser è andato a buon fine
  const persistStorico = (nuovoStorico: ElaborazioneStorica[]): boolean => {
    if (!saveStorico(nuovoStorico)) {
      alert(SPAZIO_ESAURITO);
      return false;
    }
    setStorico(nuovoStorico);
    return true;
  };

  const defaultSaveTitle = () => `Settimana del ${weekDays[0].dateStr} (${lavoratori.length} dipendenti)`;

  const handleSaveToStorico = () => {
    if (lavoratori.length === 0) return;
    const titolo = (saveTitle ?? '').trim() || defaultSaveTitle();
    const nuovaElaborazione: ElaborazioneStorica = {
      id: `elab-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      titolo,
      createdAt: new Date().toISOString(),
      selectedDate,
      employer: { ...employer },
      rawRows,
      lavoratoriElaborati: lavoratori,
      inputMethod,
      pastedText,
    };
    if (!persistStorico([nuovaElaborazione, ...storico])) return;
    setSaveTitle(null);
    alert(`Elaborazione "${titolo}" salvata correttamente nello storico!`);
  };

  const handleLoadFromStorico = (elab: ElaborazioneStorica) => {
    if (isProcessed && !window.confirm('Caricando questa elaborazione sovrascriverai i dati attualmente a schermo. Continuare?')) {
      return;
    }
    setEmployer(elab.employer);
    setSelectedDate(elab.selectedDate);
    setRawRows(elab.rawRows);
    setLavoratori(elab.lavoratoriElaborati.map(lav => riallineaPrestazioni(lav, elab.selectedDate)));
    setInputMethod(elab.inputMethod);
    setPastedText(elab.pastedText);
    setIsProcessed(true);
    setEditing(null);
    closePreview();

    setTimeout(() => {
      document.getElementById('processed-results-section')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleRemoveFromStorico = (elab: ElaborazioneStorica) => {
    if (window.confirm(`Sei sicuro di voler eliminare l'elaborazione "${elab.titolo}" dallo storico?`)) {
      persistStorico(storico.filter(s => s.id !== elab.id));
    }
  };

  const handleExportStorico = () => {
    const oggi = formatDateIT(new Date()).split('/').reverse().join('-'); // YYYY-MM-DD in ora locale
    downloadBlob(JSON.stringify(storico, null, 2), `Backup_Storico_Intermittenti_${oggi}.json`, 'application/json');
  };

  const handleImportStorico = async (file: File) => {
    let importate: ElaborazioneStorica[] | null;
    try {
      importate = sanitizeStorico(JSON.parse(await file.text()));
    } catch (err) {
      console.error(err);
      alert('Errore nella lettura del file. Assicurati che sia un file JSON valido generato da questo applicativo.');
      return;
    }
    if (!importate) {
      alert('Il file caricato non sembra essere un file di backup dello storico valido.');
      return;
    }

    if (window.confirm(`Trovate ${importate.length} elaborazioni nel file di backup. Vuoi unirle a quelle esistenti (OK) o sovrascrivere lo storico attuale (Annulla)?`)) {
      const perId = new Map(storico.map(s => [s.id, s]));
      importate.forEach(item => perId.set(item.id, item));
      const unito = Array.from(perId.values()).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      if (persistStorico(unito)) alert('Storico importato con successo! Le elaborazioni sono state unite.');
    } else if (window.confirm('Sei sicuro di voler sovrascrivere interamente lo storico attuale con quello del file? Questa operazione non si può annullare.')) {
      if (persistStorico(importate)) alert('Storico sovrascritto con successo!');
    }
  };

  if (!session) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col justify-between" id="app-container">
      <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-10" id="header-nav">
        <div className="max-w-7xl mx-auto px-4 py-3.5 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2.5 rounded-lg text-white shadow-md shadow-blue-600/10">
              <FileCheck className="w-6 h-6" />
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

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200/60 px-3 py-1.5 rounded-xl shadow-2xs">
              {session.picture ? (
                <img src={session.picture} alt={session.name} className="w-6 h-6 rounded-full border border-slate-200" referrerPolicy="no-referrer" />
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
              aria-label="Disconnetti"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full space-y-8" id="main-content-section">
        {/* ROW 1: CONFIGURAZIONE DATORE E SETTIMANA */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8" id="configuration-row">
          <div className="lg:col-span-6 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Building2 className="w-5 h-5 text-blue-600" />
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">1. Dati Datore di Lavoro (Azienda)</h2>
            </div>
            <p className="text-xs text-slate-500">I dati che verranno impressi in testa ad ogni singolo modulo PDF generato.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="employer-cf" className="block text-xs font-bold text-slate-600 mb-1.5">CODICE FISCALE *</label>
                <input
                  id="employer-cf"
                  type="text"
                  value={employer.codiceFiscale}
                  onChange={e => setEmployer({ ...employer, codiceFiscale: e.target.value })}
                  placeholder="Inserisci CF azienda"
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="employer-email" className="block text-xs font-bold text-slate-600 mb-1.5">E-MAIL *</label>
                <input
                  id="employer-email"
                  type="email"
                  value={employer.email}
                  onChange={e => setEmployer({ ...employer, email: e.target.value })}
                  placeholder="Inserisci e-mail azienda"
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          <div className="lg:col-span-6 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <CalendarDays className="w-5 h-5 text-blue-600" />
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">2. Settimana di Riferimento</h2>
            </div>
            <p className="text-xs text-slate-500">
              Seleziona un giorno qualsiasi per identificare la settimana. Il sistema calcolerà le date esatte.
            </p>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="w-full sm:w-auto">
                <label htmlFor="week-date" className="block text-xs font-bold text-slate-600 mb-1.5">DATA DI RIFERIMENTO</label>
                <input id="week-date" type="date" value={selectedDate} onChange={e => handleWeekChange(e.target.value)} className={inputClass} />
              </div>
              <div className="flex-1">
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Mappatura Date Settimana Calcolata
                </span>
                <div className="grid grid-cols-7 gap-1 bg-slate-50 p-2 rounded-lg border border-slate-100">
                  {weekDays.map(wd => (
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

        <StoricoPanel
          storico={storico}
          onLoad={handleLoadFromStorico}
          onDownloadPdf={handleDownloadStoricoPdf}
          onRemove={handleRemoveFromStorico}
          onExport={handleExportStorico}
          onImport={handleImportStorico}
        />

        {/* ROW 2: INPUT DATI EXCEL */}
        {!isProcessed && (
          <DataInput
            inputMethod={inputMethod}
            onInputMethodChange={setInputMethod}
            pastedText={pastedText}
            onPastedTextChange={setPastedText}
            onElaboraPaste={handleElaboraPaste}
            onFile={handleFile}
          />
        )}

        {/* ROW 3: RISULTATI ELABORATI */}
        {isProcessed && (
          <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6" id="processed-results-section">
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="bg-emerald-100 p-2.5 rounded-xl text-emerald-700">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">Elaborazione Completata Con Successo</h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Trovati <strong>{lavoratori.length} lavoratori</strong> distinti con turni attivi nella settimana selezionata.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  onClick={handleDownloadCombined}
                  disabled={isGenerating || lavoratori.length === 0}
                  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <FileText className="w-4 h-4" />
                  Scarica PDF Unico (Tutti)
                </button>
                <button
                  onClick={handleDownloadZip}
                  disabled={isGenerating || lavoratori.length === 0}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  Scarica ZIP (Moduli Singoli)
                </button>
                <button
                  onClick={() => setSaveTitle(defaultSaveTitle())}
                  disabled={lavoratori.length === 0}
                  className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
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
                  <div className="bg-blue-600 h-full transition-all duration-300" style={{ width: `${progress}%` }} />
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
              <WorkerList
                lavoratori={lavoratori}
                previewCf={preview?.cf ?? null}
                onPreview={showPreview}
                onEdit={startEditing}
                onRemove={handleRemoveLavoratore}
              />

              <div className="xl:col-span-5 flex flex-col space-y-6">
                {editing && (
                  <EditPanel
                    lavoratore={editing.draft}
                    mondayISO={selectedDate}
                    onChange={draft => setEditing({ ...editing, draft })}
                    onSave={handleSaveEdit}
                    onCancel={() => setEditing(null)}
                  />
                )}
                <PreviewPanel url={previewUrl} loading={isPreviewLoading} onClose={closePreview} />
              </div>
            </div>
          </motion.div>
        )}
      </main>

      <footer className="bg-white border-t border-slate-200 py-6 mt-16" id="footer-section">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-xs text-slate-400 space-y-2">
          <p>© 2026 Berti Food S.r.l. • Compilatore automatico Comunicazioni Obbligatorie Intermittenti.</p>
          <p>
            Questo applicativo opera interamente all'interno del tuo browser. Nessun dato personale o aziendale viene salvato su database esterni o inviato a server terzi, garantendo la totale conformità e riservatezza dei dati.
          </p>
        </div>
      </footer>

      <AnimatePresence>
        {saveTitle !== null && (
          <Modal
            id="save-historical-dialog"
            title="Salva nello Storico"
            icon={<Save className="w-5 h-5" />}
            iconClassName="text-blue-600"
            onClose={() => setSaveTitle(null)}
          >
            <p className="text-xs text-slate-500 leading-relaxed">
              Assegna un nome identificativo a questa elaborazione per poterla rintracciare e ricaricare facilmente in futuro.
            </p>
            <div className="space-y-1.5">
              <label htmlFor="save-title" className="block text-[10px] font-bold text-slate-500 uppercase">Titolo Elaborazione</label>
              <input
                id="save-title"
                type="text"
                value={saveTitle}
                onChange={e => setSaveTitle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSaveToStorico()}
                placeholder={`es. Settimana del ${weekDays[0].dateStr}`}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium text-slate-800"
                autoFocus
              />
            </div>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setSaveTitle(null)}
                className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-lg transition-all cursor-pointer"
              >
                Annulla
              </button>
              <button
                onClick={handleSaveToStorico}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-sm transition-all cursor-pointer"
              >
                Conferma e Salva
              </button>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSignOutConfirm && (
          <Modal
            id="signout-confirmation-dialog"
            title="Disconnessione"
            icon={<LogOut className="w-5 h-5" />}
            iconClassName="text-red-600"
            maxWidthClassName="max-w-sm"
            onClose={() => setShowSignOutConfirm(false)}
          >
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
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}
