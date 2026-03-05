import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { Modal, type ModalProps } from '../components/ui/Modal';
import { ToastContainer, type ToastProps } from '../components/ui/Toast';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastMessage extends ToastProps {
  id: string;
}

interface UIContextData {
  // Modal Methods
  alert: (title: string, message: string) => Promise<void>;
  confirm: (title: string, message: string, options?: { confirmText?: string; cancelText?: string; type?: 'danger' | 'warning' | 'info' }) => Promise<boolean>;
  prompt: (title: string, message: string, defaultValue?: string) => Promise<string | null>;
  
  // Toast Methods
  toast: {
    success: (message: string, title?: string) => void;
    error: (message: string, title?: string) => void;
    warning: (message: string, title?: string) => void;
    info: (message: string, title?: string) => void;
  };
}

const UIContext = createContext<UIContextData>({} as UIContextData);

export const UIProvider = ({ children }: { children: ReactNode }) => {
  // Modal State
  const [modalState, setModalState] = useState<ModalProps | null>(null);
  
  // Toast State
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Modal Promise Resolver
  const [modalResolver, setModalResolver] = useState<{ resolve: (value: any) => void } | null>(null);

  // --- Modal Logic ---

  const close = useCallback(() => {
    setModalState(null);
    setModalResolver(null);
  }, []);

  const alert = useCallback((title: string, message: string) => {
    return new Promise<void>((resolve) => {
      setModalResolver({ resolve });
      setModalState({
        isOpen: true,
        type: 'alert',
        title,
        message,
        onConfirm: () => {
          resolve();
          close();
        },
        onCancel: () => {
          resolve();
          close();
        }
      });
    });
  }, [close]);

  const confirm = useCallback((title: string, message: string, options?: { confirmText?: string; cancelText?: string; type?: 'danger' | 'warning' | 'info' }) => {
    return new Promise<boolean>((resolve) => {
      setModalResolver({ resolve });
      setModalState({
        isOpen: true,
        type: 'confirm',
        title,
        message,
        confirmText: options?.confirmText,
        cancelText: options?.cancelText,
        variant: options?.type,
        onConfirm: () => {
          resolve(true);
          close();
        },
        onCancel: () => {
          resolve(false);
          close();
        }
      });
    });
  }, [close]);

  const prompt = useCallback((title: string, message: string, defaultValue?: string) => {
    return new Promise<string | null>((resolve) => {
      setModalResolver({ resolve });
      setModalState({
        isOpen: true,
        type: 'prompt',
        title,
        message,
        defaultValue,
        onConfirm: (value?: string) => {
          resolve(value || '');
          close();
        },
        onCancel: () => {
          resolve(null);
          close();
        }
      });
    });
  }, [close]);

  // --- Toast Logic ---

  const addToast = useCallback((type: ToastType, message: string, title?: string) => {
    const id = Math.random().toString(36).substring(7);
    const newToast: ToastMessage = {
      id,
      type,
      message,
      title,
      onClose: () => removeToast(id)
    };

    setToasts((prev) => [...prev, newToast]);

    // Auto remove after 5 seconds
    setTimeout(() => {
      removeToast(id);
    }, 5000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = {
    success: (msg: string, title?: string) => addToast('success', msg, title),
    error: (msg: string, title?: string) => addToast('error', msg, title),
    warning: (msg: string, title?: string) => addToast('warning', msg, title),
    info: (msg: string, title?: string) => addToast('info', msg, title),
  };

  return (
    <UIContext.Provider value={{ alert, confirm, prompt, toast }}>
      {children}
      
      {/* Global Modal Container */}
      {modalState && <Modal {...modalState} />}
      
      {/* Global Toast Container */}
      <ToastContainer toasts={toasts} />
    </UIContext.Provider>
  );
};

export const useUI = () => {
  const context = useContext(UIContext);
  if (!context) {
    throw new Error('useUI must be used within a UIProvider');
  }
  return context;
};
