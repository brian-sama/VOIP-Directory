import React, { createContext, useContext, useState, useCallback } from 'react';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
    id: number;
    message: string;
    type: ToastType;
}

interface ToastContextType {
    success: (msg: string) => void;
    error: (msg: string) => void;
    info: (msg: string) => void;
    warning: (msg: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const addToast = useCallback((message: string, type: ToastType = 'info', duration = 3000) => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type }]);

        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, duration);
    }, []);

    const success = useCallback((message: string) => addToast(message, 'success'), [addToast]);
    const error = useCallback((message: string) => addToast(message, 'error'), [addToast]);
    const info = useCallback((message: string) => addToast(message, 'info'), [addToast]);
    const warning = useCallback((message: string) => addToast(message, 'warning'), [addToast]);

    return (
        <ToastContext.Provider value={{ success, error, info, warning }}>
            {children}
            <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3">
                {toasts.map(toast => (
                    <div
                        key={toast.id}
                        className={`
              px-6 py-4 rounded-2xl shadow-2xl animate-in slide-in-from-right-10 duration-300
              ${toast.type === 'success' ? 'bg-emerald-600 text-white' : ''}
              ${toast.type === 'error' ? 'bg-rose-600 text-white' : ''}
              ${toast.type === 'info' ? 'bg-blue-600 text-white' : ''}
              ${toast.type === 'warning' ? 'bg-amber-500 text-white' : ''}
            `}
                    >
                        <p className="font-bold text-sm">{toast.message}</p>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
};
