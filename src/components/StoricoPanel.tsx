import { ChangeEvent, useState } from 'react';
import { Archive, FileDown, FileText, FileUp, FolderOpen, History, Trash2 } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { ElaborazioneStorica } from '../types';
import { formatDateIT, parseISODateLocal } from '../utils/dates';

interface StoricoPanelProps {
  storico: ElaborazioneStorica[];
  onLoad: (elab: ElaborazioneStorica) => void;
  onDownloadPdf: (elab: ElaborazioneStorica) => void;
  onRemove: (elab: ElaborazioneStorica) => void;
  onExport: () => void;
  onImport: (file: File) => void;
}

export default function StoricoPanel({ storico, onLoad, onDownloadPdf, onRemove, onExport, onImport }: StoricoPanelProps) {
  const [expanded, setExpanded] = useState(false);

  const handleImport = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onImport(file);
    // Consente di selezionare di nuovo lo stesso file
    e.target.value = '';
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden" id="historical-archive-section">
      <button
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
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
        <span className="text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg">
          {expanded ? 'Comprimi ▴' : 'Espandi ▾'}
        </span>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-slate-100 overflow-hidden"
          >
            <div className="p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                <span className="text-xs font-medium text-slate-500">
                  I dati sono salvati solo in questo browser: esporta periodicamente un backup per non perderli.
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={onExport}
                    disabled={storico.length === 0}
                    className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                  >
                    <FileDown className="w-3.5 h-3.5 text-slate-500" />
                    Esporta Backup JSON
                  </button>
                  <label className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs">
                    <FileUp className="w-3.5 h-3.5 text-slate-500" />
                    Importa Backup JSON
                    <input type="file" accept=".json,application/json" onChange={handleImport} className="hidden" />
                  </label>
                </div>
              </div>

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
                  storico.map(item => (
                    <div key={item.id} className="p-4 hover:bg-slate-50/50 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <h4 className="text-sm font-bold text-slate-800">{item.titolo}</h4>
                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-400 font-medium">
                          <span className="text-blue-600 font-bold bg-blue-50 px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider">
                            {item.lavoratoriElaborati.length} lavoratori
                          </span>
                          <span>•</span>
                          <span className="font-mono">Settimana del {formatDateIT(parseISODateLocal(item.selectedDate))}</span>
                          <span>•</span>
                          <span>Azienda: <strong className="text-slate-500">{item.employer.codiceFiscale}</strong></span>
                          <span>•</span>
                          <span>Salvato il: {new Date(item.createdAt).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' })}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 self-end sm:self-center">
                        <button
                          onClick={() => onLoad(item)}
                          className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
                          title="Carica a schermo"
                        >
                          <FolderOpen className="w-3.5 h-3.5" />
                          Ripristina
                        </button>
                        <button
                          onClick={() => onDownloadPdf(item)}
                          className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold cursor-pointer"
                          title="Scarica PDF unico direttamente"
                          aria-label="Scarica PDF unico"
                        >
                          <FileText className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onRemove(item)}
                          className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs font-bold cursor-pointer"
                          title="Elimina dallo storico"
                          aria-label="Elimina dallo storico"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
