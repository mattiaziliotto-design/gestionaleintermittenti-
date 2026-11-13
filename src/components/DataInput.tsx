import { ChangeEvent, DragEvent, useRef, useState } from 'react';
import { Edit2, FileSpreadsheet, Info, RefreshCw, UploadCloud } from 'lucide-react';
import { motion } from 'motion/react';

interface DataInputProps {
  inputMethod: 'paste' | 'upload';
  onInputMethodChange: (method: 'paste' | 'upload') => void;
  pastedText: string;
  onPastedTextChange: (text: string) => void;
  onElaboraPaste: () => void;
  onFile: (file: File) => void;
}

const tabClass = (active: boolean) =>
  `flex-1 py-4 text-center text-sm font-bold flex items-center justify-center gap-2 border-b-2 transition-all cursor-pointer ${
    active ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-slate-500 hover:text-slate-800'
  }`;

export default function DataInput({ inputMethod, onInputMethodChange, pastedText, onPastedTextChange, onElaboraPaste, onFile }: DataInputProps) {
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === 'dragenter' || e.type === 'dragover');
  };

  const handleDrop = (e: DragEvent) => {
    handleDrag(e);
    const file = e.dataTransfer.files?.[0];
    if (file) onFile(file);
  };

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFile(file);
    // Consente di ricaricare lo stesso file dopo una correzione
    e.target.value = '';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
      id="data-input-box"
    >
      <div className="flex border-b border-slate-100 bg-slate-50/50">
        <button onClick={() => onInputMethodChange('paste')} className={tabClass(inputMethod === 'paste')}>
          <Edit2 className="w-4 h-4" />
          Incolla Copia-Incolla da Excel
        </button>
        <button onClick={() => onInputMethodChange('upload')} className={tabClass(inputMethod === 'upload')}>
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
              onChange={e => onPastedTextChange(e.target.value)}
              aria-label="Dati incollati da Excel"
              placeholder={'Incolla qui i dati da Excel...\nEsempio:\nRSSMRA80A01F205X\tMARIO ROSSI\tSAB\nRSSMRA80A01F205X\tMARIO ROSSI\tDOM\nBNCHRA85B41F205Y\tLAURA BIANCHI\tDOM'}
              className="w-full p-4 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />

            <div className="flex justify-end">
              <button
                onClick={onElaboraPaste}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-md shadow-blue-600/15 flex items-center gap-2 transition-all cursor-pointer active:scale-98"
              >
                <RefreshCw className="w-4 h-4" />
                Elabora e Raggruppa
              </button>
            </div>
          </div>
        ) : (
          <div
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${
              dragActive ? 'border-blue-500 bg-blue-50/20' : 'border-slate-300 hover:border-slate-400 bg-slate-50/50'
            }`}
          >
            <input ref={fileInputRef} type="file" accept=".xlsx, .xls, .csv" onChange={handleFileSelect} className="hidden" />
            <FileSpreadsheet className="w-12 h-12 text-blue-500 mx-auto mb-4" />
            <p className="text-sm font-bold text-slate-700">Trascina qui il file Excel o clicca per sfogliare</p>
            <p className="text-xs text-slate-400 mt-1">Supporta formati .xlsx, .xls, .csv</p>
            <div className="mt-4 inline-flex items-center gap-1.5 text-xs bg-white px-3 py-1.5 rounded-full border border-slate-200 text-slate-500 font-medium">
              <Info className="w-3.5 h-3.5 text-blue-500" />
              Colonne lette nell'ordine: C.F. / Nominativo / Giorno di lavoro
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
