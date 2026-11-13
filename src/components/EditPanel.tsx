import { Check, Edit2, Trash2 } from 'lucide-react';
import { LavoratoreRaggruppato } from '../types';
import { GIORNI, dateForGiorno } from '../utils/dates';

interface EditPanelProps {
  lavoratore: LavoratoreRaggruppato;
  mondayISO: string;
  onChange: (lav: LavoratoreRaggruppato) => void;
  onSave: () => void;
  onCancel: () => void;
}

// Modifica rapida di nominativo, codice fiscale e giornate di un lavoratore.
// Ogni giorno della settimana può comparire una sola volta.
export default function EditPanel({ lavoratore, mondayISO, onChange, onSave, onCancel }: EditPanelProps) {
  const giorniUsati = new Set(lavoratore.prestazioni.map(p => p.giorno));
  const primoGiornoLibero = GIORNI.find(g => !giorniUsati.has(g));
  const prestazione = (giorno: string) => ({ giorno, data: dateForGiorno(mondayISO, giorno) });

  const setPrestazioni = (prestazioni: LavoratoreRaggruppato['prestazioni']) => onChange({ ...lavoratore, prestazioni });

  return (
    <div className="bg-amber-50/50 p-5 rounded-2xl border border-amber-200 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-amber-200 pb-2">
        <span className="text-xs font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1">
          <Edit2 className="w-3.5 h-3.5" />
          Modifica rapida turni
        </span>
        <button onClick={onCancel} className="text-xs font-bold text-slate-400 hover:text-slate-600 cursor-pointer">
          Annulla
        </button>
      </div>

      <div className="space-y-3">
        <div>
          <label htmlFor="edit-nominativo" className="block text-[10px] font-bold text-slate-500 uppercase">Nominativo</label>
          <input
            id="edit-nominativo"
            type="text"
            value={lavoratore.nominativo}
            onChange={e => onChange({ ...lavoratore, nominativo: e.target.value })}
            className="w-full mt-1 px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 uppercase font-bold text-slate-800"
          />
        </div>
        <div>
          <label htmlFor="edit-cf" className="block text-[10px] font-bold text-slate-500 uppercase font-mono">Codice Fiscale</label>
          <input
            id="edit-cf"
            type="text"
            value={lavoratore.codiceFiscale}
            onChange={e => onChange({ ...lavoratore, codiceFiscale: e.target.value.toUpperCase() })}
            className="w-full mt-1 px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono uppercase"
          />
        </div>

        <div className="space-y-2 pt-1">
          <span className="block text-[10px] font-bold text-slate-500 uppercase">Giornate di Prestazione</span>

          <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
            {lavoratore.prestazioni.map((p, idx) => (
              <div key={p.giorno} className="flex items-center gap-2 bg-white p-2 rounded-lg border border-slate-100">
                <select
                  value={p.giorno}
                  aria-label="Giorno della prestazione"
                  onChange={e => setPrestazioni(lavoratore.prestazioni.map((old, i) => (i === idx ? prestazione(e.target.value) : old)))}
                  className="bg-slate-50 border border-slate-200 rounded text-xs px-2 py-1 font-bold text-blue-600"
                >
                  {GIORNI.map(g => (
                    <option key={g} value={g} disabled={g !== p.giorno && giorniUsati.has(g)}>{g}</option>
                  ))}
                </select>
                <span className="text-xs font-mono text-slate-500 flex-1">{p.data}</span>
                <button
                  onClick={() => setPrestazioni(lavoratore.prestazioni.filter((_, i) => i !== idx))}
                  className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded cursor-pointer"
                  title="Rimuovi prestazione"
                  aria-label="Rimuovi prestazione"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={() => primoGiornoLibero && setPrestazioni([...lavoratore.prestazioni, prestazione(primoGiornoLibero)])}
              disabled={!primoGiornoLibero}
              className="flex-1 py-1.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-600 rounded-lg text-xs font-bold transition-all cursor-pointer"
            >
              + Aggiungi Giorno
            </button>
            <button
              onClick={onSave}
              className="flex-1 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 shadow-sm cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              Salva modifiche
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
