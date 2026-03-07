import React, { useEffect, useRef, useState } from 'react';
import { X, Check, AlertTriangle, Info, AlertCircle } from 'lucide-react';

export type ModalType = 'alert' | 'confirm' | 'prompt';
export type ModalVariant = 'danger' | 'warning' | 'info' | 'success';

export interface ModalProps {
  isOpen: boolean;
  type: ModalType;
  title: string;
  message: string;
  variant?: ModalVariant;
  defaultValue?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: (value?: string) => void;
  onCancel: () => void;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  type,
  title,
  message,
  variant = 'info',
  defaultValue = '',
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  onConfirm,
  onCancel
}) => {
  const [inputValue, setInputValue] = useState(defaultValue);
  const modalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      if (type === 'prompt' && inputRef.current) {
        inputRef.current.focus();
      }
    } else {
      document.body.style.overflow = 'unset';
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
      if (e.key === 'Enter' && type !== 'alert') {
        // Prevent default form submission if inside form
        e.preventDefault();
        onConfirm(inputValue);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onCancel, onConfirm, inputValue, type]);

  if (!isOpen) return null;

  const getIcon = () => {
    switch (variant) {
      case 'danger':
        return <AlertTriangle className="w-6 h-6 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="w-6 h-6 text-orange-500" />;
      case 'success':
        return <Check className="w-6 h-6 text-green-500" />;
      case 'info':
      default:
        return <Info className="w-6 h-6 text-blue-500" />;
    }
  };

  const getButtonColor = () => {
    switch (variant) {
      case 'danger':
        return 'bg-red-500 hover:bg-red-600 focus:ring-red-500';
      case 'warning':
        return 'bg-orange-500 hover:bg-orange-600 focus:ring-orange-500';
      case 'success':
        return 'bg-green-500 hover:bg-green-600 focus:ring-green-500';
      default:
        return 'bg-blue-500 hover:bg-blue-600 focus:ring-blue-500';
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* 1. Overlay Premium */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-md z-0 animate-in fade-in duration-300"
        onClick={onCancel}
      >
        <div className="absolute inset-0 opacity-[0.03] bg-[url('https://grainy-gradients.vercel.app/noise.svg')]"></div>
      </div>

      {/* 2. Container Glass Premium */}
      <div
        ref={modalRef}
        className="relative z-10 w-full max-w-md bg-[#0a0a1a]/10 backdrop-blur-xl border border-white/10 rounded-[22px] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.6)] overflow-hidden animate-in zoom-in-95 duration-300 ring-1 ring-white/10 ring-inset"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {/* Grain Texture Overlay */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')] z-0"></div>
        {/* Glow Effects */}
        <div className="absolute inset-0 rounded-[22px] border border-white/5 pointer-events-none"></div>
        <div className="absolute top-[-50px] left-1/2 -translate-x-1/2 w-[80%] h-[100px] bg-primary/40 blur-[80px] pointer-events-none rounded-[100%]"></div>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/3 h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent shadow-[0_0_20px_2px_rgba(99,102,241,0.6)]"></div>

        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-2 relative z-20">
          <div className="flex items-center gap-4">
            <div className={`p-2.5 rounded-xl bg-white/[0.03] border border-white/10 shadow-inner`}>
              {getIcon()}
            </div>
            <h3 id="modal-title" className="text-lg font-medium text-[#EEEEEE]">
              {title}
            </h3>
          </div>
          <button
            onClick={onCancel}
            className="p-1.5 text-gray-500 hover:text-white transition-colors rounded-lg hover:bg-white/10"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 pt-2 relative z-20">
          <p className="text-[#6e6e6e] text-sm leading-relaxed font-light mb-5 ml-1">
            {message}
          </p>

          {type === 'prompt' && (
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="w-full bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] rounded-xl px-4 py-3 text-white/90 placeholder-[#6e6e6e] focus:bg-white/[0.08] focus:border-primary/30 focus:ring-0 outline-none transition-all duration-300 text-sm font-light shadow-inner"
              placeholder="Digite aqui..."
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-5 bg-[#0a0a1a]/50 border-t border-white/5 relative z-20">
          {type !== 'alert' && (
            <button
              onClick={onCancel}
              className="px-5 py-2.5 text-sm text-[#6e6e6e] hover:text-white transition-colors hover:bg-white/5 rounded-xl font-light"
            >
              {cancelText}
            </button>
          )}

          <button
            onClick={() => onConfirm(inputValue)}
            className={`px-6 py-2.5 text-sm font-medium text-white rounded-xl shadow-lg transition-all transform hover:-translate-y-0.5 active:translate-y-0 ${variant === 'danger' ? 'bg-red-500/80 hover:bg-red-500 shadow-red-500/20' :
                variant === 'warning' ? 'bg-orange-500/80 hover:bg-orange-500 shadow-orange-500/20' :
                  variant === 'success' ? 'bg-green-500/80 hover:bg-green-500 shadow-green-500/20' :
                    'bg-white/[0.05] hover:bg-white/[0.1] border border-white/5 hover:border-white/20'
              } flex items-center gap-2 group`}
          >
            <span>{type === 'alert' ? 'OK' : confirmText}</span>
            {type !== 'alert' && <span className={`transition-transform group-hover:translate-x-1 ${variant === 'info' ? 'text-primary' : 'text-white/80'}`}>→</span>}
          </button>
        </div>
      </div>
    </div>
  );
};
