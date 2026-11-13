import { Eye, FileText, RefreshCw } from 'lucide-react';

interface PreviewPanelProps {
  url: string | null;
  loading: boolean;
  onClose: () => void;
}

export default function PreviewPanel({ url, loading, onClose }: PreviewPanelProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex-1 flex flex-col min-h-[350px]">
      <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
        <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
          <FileText className="w-4 h-4 text-blue-500" />
          Anteprima Modulo PDF Ministeriale
        </span>
        {url && (
          <button onClick={onClose} className="text-xs text-slate-400 hover:text-slate-600 font-bold transition-all cursor-pointer">
            Chiudi
          </button>
        )}
      </div>

      <div className="flex-1 bg-slate-100 flex items-center justify-center relative min-h-[350px]">
        {loading && (
          <div className="absolute inset-0 bg-white/85 flex flex-col items-center justify-center z-10 gap-2">
            <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
            <span className="text-xs font-bold text-slate-600">Generazione anteprima in corso...</span>
          </div>
        )}

        {url ? (
          <iframe src={`${url}#toolbar=0&navpanes=0&scrollbar=0`} className="w-full h-full border-none min-h-[400px]" title="Anteprima PDF" />
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
  );
}
