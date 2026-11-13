import { ReactNode } from 'react';
import { motion } from 'motion/react';

interface ModalProps {
  id: string;
  title: string;
  icon: ReactNode;
  iconClassName: string;
  maxWidthClassName?: string;
  onClose: () => void;
  children: ReactNode;
}

// Finestra di dialogo con sfondo semitrasparente (da usare dentro <AnimatePresence>)
export default function Modal({ id, title, icon, iconClassName, maxWidthClassName = 'max-w-md', onClose, children }: ModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" id={id} role="dialog" aria-modal="true" aria-label={title}>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/45 backdrop-blur-[2px]"
      />
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className={`bg-white rounded-2xl border border-slate-200 shadow-2xl ${maxWidthClassName} w-full p-6 relative z-10 space-y-4`}
      >
        <div className={`flex items-center gap-2 border-b border-slate-100 pb-3 ${iconClassName}`}>
          {icon}
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">{title}</h3>
        </div>
        {children}
      </motion.div>
    </div>
  );
}
