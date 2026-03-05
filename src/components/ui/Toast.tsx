import React, { useEffect, useState } from 'react';
import { X, CheckCircle, AlertTriangle, AlertCircle, Info } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastProps {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
  onClose: () => void;
}

const icons = {
  success: <CheckCircle className="w-5 h-5 text-green-500" />,
  error: <AlertCircle className="w-5 h-5 text-red-500" />,
  warning: <AlertTriangle className="w-5 h-5 text-orange-500" />,
  info: <Info className="w-5 h-5 text-blue-500" />,
};

const bgColors = {
  success: 'bg-green-500/10 border-green-500/20',
  error: 'bg-red-500/10 border-red-500/20',
  warning: 'bg-orange-500/10 border-orange-500/20',
  info: 'bg-blue-500/10 border-blue-500/20',
};

const progressColors = {
  success: 'bg-green-500',
  error: 'bg-red-500',
  warning: 'bg-orange-500',
  info: 'bg-blue-500',
};

export const Toast: React.FC<ToastProps> = ({
  id,
  type,
  title,
  message,
  duration = 5000,
  onClose
}) => {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      handleClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration]);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(onClose, 300); // Wait for animation
  };

  return (
    <div
      className={`
        relative flex items-start w-full max-w-sm overflow-hidden rounded-lg shadow-lg ring-1 ring-black/5 backdrop-blur-md transition-all duration-300 ease-in-out transform
        ${isExiting ? 'translate-x-full opacity-0' : 'translate-x-0 opacity-100'}
        ${bgColors[type]}
        bg-[#1a1a2e]/90 border border-white/10
      `}
      role="alert"
    >
      <div className="p-4 flex gap-3 w-full">
        <div className="flex-shrink-0 pt-0.5">
          {icons[type]}
        </div>
        <div className="flex-1 w-0">
          {title && (
            <p className="text-sm font-medium text-white mb-1">
              {title}
            </p>
          )}
          <p className="text-sm text-gray-300 leading-relaxed">
            {message}
          </p>
        </div>
        <div className="flex-shrink-0 flex self-start ml-4">
          <button
            onClick={handleClose}
            className="inline-flex text-gray-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary rounded-md p-1 hover:bg-white/10 transition-colors"
          >
            <span className="sr-only">Close</span>
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      {/* Progress Bar Animation */}
      <div 
        className={`absolute bottom-0 left-0 h-1 w-full animate-progress origin-left ${progressColors[type]}`} 
        style={{ animationDuration: `${duration}ms` }} 
      />
    </div>
  );
};

export const ToastContainer: React.FC<{ toasts: ToastProps[] }> = ({ toasts }) => {
  return (
    <div 
      aria-live="assertive" 
      className="fixed inset-0 z-[60] flex flex-col items-end px-4 py-6 pointer-events-none sm:p-6 sm:items-start space-y-4"
    >
      <div className="w-full flex flex-col items-end space-y-4 pointer-events-auto">
        {toasts.map((toast) => (
          <Toast key={toast.id} {...toast} />
        ))}
      </div>
    </div>
  );
};
