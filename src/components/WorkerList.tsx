import { AlertTriangle, Edit2, Eye, Trash2 } from 'lucide-react';
import { LavoratoreRaggruppato } from '../types';
import { isCodiceFiscaleValido } from '../utils/codiceFiscale';
import { getIntervalliLavorativi } from '../utils/intervalli';

interface WorkerListProps {
  lavoratori: LavoratoreRaggruppato[];
  previewCf: string | null;
  onPreview: (lav: LavoratoreRaggruppato) => void;
  onEdit: (lav: LavoratoreRaggruppato) => void;
  onRemove: (lav: LavoratoreRaggruppato) => void;
}

const actionClass = 'p-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer';

export default function WorkerList({ lavoratori, previewCf, onPreview, onEdit, onRemove }: WorkerListProps) {
  return (
    <div className="xl:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
      <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
        <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Lavoratori & Servizi Abbinati</span>
        <span className="text-xs font-semibold bg-blue-100 text-blue-800 px-2.5 py-0.5 rounded-full">{lavoratori.length} record</span>
      </div>

      <div className="divide-y divide-slate-100 overflow-y-auto max-h-[550px]">
        {lavoratori.map(lav => (
          <div
            key={lav.codiceFiscale}
            className={`p-4 transition-all hover:bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
              previewCf === lav.codiceFiscale ? 'bg-blue-50/30 border-l-4 border-blue-500 pl-3' : ''
            }`}
          >
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-slate-900 uppercase">{lav.nominativo}</h4>
              <div className="flex flex-wrap items-center gap-2 font-mono text-xs text-slate-500">
                <span>{lav.codiceFiscale}</span>
                <span className="text-slate-300">•</span>
                <span className="text-blue-600 font-bold bg-blue-50 px-1.5 py-0.5 rounded">{lav.prestazioni.length} giornate</span>
                {!isCodiceFiscaleValido(lav.codiceFiscale) && (
                  <span className="inline-flex items-center gap-1 text-amber-700 font-bold bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded font-sans">
                    <AlertTriangle className="w-3 h-3" />
                    Codice fiscale da verificare
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1.5">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Giornate:</span>
                <div className="flex flex-wrap gap-1">
                  {lav.prestazioni.map(p => (
                    <span
                      key={p.giorno}
                      className="inline-flex items-center gap-1 text-[10px] font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200/60 font-mono"
                    >
                      {p.giorno} {p.data.substring(0, 5)}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-[10px] text-blue-500 font-bold uppercase tracking-wider">Righe nel modulo (giorni consecutivi uniti):</span>
                <div className="flex flex-wrap gap-1">
                  {getIntervalliLavorativi(lav.prestazioni).map(interv => (
                    <span
                      key={interv.dataInizio}
                      className="inline-flex items-center gap-1 text-[10px] font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200 font-mono"
                    >
                      {interv.dataInizio === interv.dataFine
                        ? interv.dataInizio.substring(0, 5)
                        : `${interv.dataInizio.substring(0, 5)} ➔ ${interv.dataFine.substring(0, 5)} (${interv.giorni.join('-')})`}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 self-end sm:self-center">
              <button onClick={() => onPreview(lav)} className={`${actionClass} bg-blue-50 text-blue-600 hover:bg-blue-100`} title="Mostra Anteprima PDF">
                <Eye className="w-3.5 h-3.5" />
                Anteprima
              </button>
              <button onClick={() => onEdit(lav)} className={`${actionClass} bg-slate-100 text-slate-600 hover:bg-slate-200`} title="Modifica Turni">
                <Edit2 className="w-3.5 h-3.5" />
                Modifica
              </button>
              <button onClick={() => onRemove(lav)} className={`${actionClass} bg-red-50 text-red-600 hover:bg-red-100`} title="Rimuovi">
                <Trash2 className="w-3.5 h-3.5" />
                Rimuovi
              </button>
            </div>
          </div>
        ))}

        {lavoratori.length === 0 && (
          <div className="p-8 text-center text-slate-400 text-sm">
            Nessun lavoratore nell'elenco. Premi "Pulisci e Riavvia" per caricare nuovi dati.
          </div>
        )}
      </div>
    </div>
  );
}
