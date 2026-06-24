import React, { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';

interface ConfirmModalProps {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  title,
  message,
  confirmLabel = 'Confirm',
  danger = false,
  onConfirm,
  onCancel,
}) => {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[400] flex items-center justify-center p-6"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 animate-fade-in">
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 ${danger ? 'bg-rose-50' : 'bg-amber-50'}`}>
          <AlertTriangle className={`w-7 h-7 ${danger ? 'text-rose-600' : 'text-amber-600'}`} />
        </div>
        <h3 className="text-lg font-black text-slate-900 mb-2">{title}</h3>
        <p className="text-sm text-slate-500 font-medium mb-8 leading-relaxed">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-2xl font-bold text-sm hover:bg-slate-200 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`flex-[2] py-3 text-white rounded-2xl font-bold text-sm transition-all ${danger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-blue-600 hover:bg-blue-700'}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
