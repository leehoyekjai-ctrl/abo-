import { X } from 'lucide-react';
import type { ReactNode } from 'react';

interface Props {
  isOpen: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}

export function ModalShell({ isOpen, title, subtitle, onClose, children, wide }: Props) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center bg-slate-900/60 p-0 sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={`bg-white w-full ${wide ? 'sm:max-w-3xl' : 'sm:max-w-md'} max-h-[92vh] flex flex-col rounded-t-2xl sm:rounded-2xl shadow-2xl`}
      >
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-100">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-slate-900">{title}</h2>
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose} aria-label="닫기" className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 cursor-pointer shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
