import React from 'react';
import { X, Bell, Check, Trash2, Clock } from 'lucide-react';

interface Notification {
  id: string;
  title: string;
  description: string;
  created_at: string;
  unread: boolean;
}

interface NotificationsHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: Notification[];
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onDelete: (id: string) => void;
}

const NotificationsHistoryModal: React.FC<NotificationsHistoryModalProps> = ({
  isOpen,
  onClose,
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
  onDelete
}) => {
  if (!isOpen) return null;

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const hasUnread = notifications.some(n => n.unread);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* 1. Overlay Premium */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-md z-0 animate-in fade-in duration-300"
        onClick={onClose}
      >
        <div className="absolute inset-0 opacity-[0.03] bg-[url('https://grainy-gradients.vercel.app/noise.svg')]"></div>
      </div>

      <div className="relative z-10 w-full max-w-2xl h-[600px] flex flex-col rounded-[22px] overflow-hidden shadow-[0_32px_64px_-12px_rgba(0,0,0,0.6)] animate-in zoom-in-95 duration-300 border border-white/10 bg-[#0a0a1a]/10 backdrop-blur-xl ring-1 ring-white/10 ring-inset">

        {/* Grain Texture Overlay */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')] z-0 rounded-[22px]"></div>

        {/* Glow Effects */}
        <div className="absolute inset-0 rounded-[22px] border border-white/5 pointer-events-none"></div>
        <div className="absolute top-[-50px] left-1/2 -translate-x-1/2 w-[60%] h-[100px] bg-primary/30 blur-[80px] pointer-events-none rounded-[100%]"></div>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/3 h-[1px] bg-gradient-to-r from-transparent via-primary/50 to-transparent"></div>

        {/* Header */}
        <div className="p-6 border-b border-white/5 flex items-center justify-between relative z-20">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20">
              <Bell size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#EEEEEE]">Histórico de Notificações</h2>
              <p className="text-xs text-[#6e6e6e] font-light">Acompanhe todas as atividades recentes</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            {hasUnread && (
              <button
                onClick={onMarkAllAsRead}
                className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-all text-[10px] font-bold uppercase tracking-wider border border-primary/20"
              >
                <Check size={14} />
                <span>Marcar todas como lidas</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 text-gray-500 hover:text-white transition-colors rounded-lg hover:bg-white/5"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-white/10 custom-scrollbar relative z-20">
          {notifications.length > 0 ? (
            <div className="space-y-4">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-5 rounded-2xl border transition-all duration-300 group relative flex flex-col gap-2 ${notification.unread
                    ? 'bg-primary/[0.03] border-primary/20 shadow-[0_0_20px_-10px_rgba(99,102,241,0.15)]'
                    : 'bg-white/[0.02] border-white/5 hover:border-white/10 hover:bg-white/[0.04]'
                    }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0 pr-4">
                      <div className="flex items-center space-x-2 mb-1">
                        {notification.unread && (
                          <span className="w-2 h-2 bg-primary rounded-full shadow-[0_0_8px_rgba(99,102,241,0.8)] animate-pulse"></span>
                        )}
                        <h4 className={`text-sm font-medium truncate ${notification.unread ? 'text-white' : 'text-gray-400'}`}>
                          {notification.title}
                        </h4>
                      </div>
                      <p className="text-xs text-[#6e6e6e] leading-relaxed group-hover:text-gray-300 transition-colors font-light">
                        {notification.description}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2 shrink-0">
                      <div className="flex items-center text-[10px] text-gray-600 font-mono">
                        <Clock size={12} className="mr-1" />
                        {new Date(notification.created_at).toLocaleDateString('pt-BR')}
                      </div>
                    </div>
                  </div>

                  {/* Actions (Reveal on Hover) */}
                  <div className="flex justify-end pt-2 border-t border-white/5 mt-2 opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0">
                    <div className="flex gap-2">
                      {notification.unread && (
                        <button
                          onClick={() => onMarkAsRead(notification.id)}
                          className="flex items-center gap-1 px-2 py-1 text-[10px] text-primary hover:bg-primary/10 rounded transition-colors"
                          title="Marcar como lida"
                        >
                          <Check size={12} /> Lida
                        </button>
                      )}
                      <button
                        onClick={() => onDelete(notification.id)}
                        className="flex items-center gap-1 px-2 py-1 text-[10px] text-red-400 hover:bg-red-500/10 rounded transition-colors"
                        title="Excluir"
                      >
                        <Trash2 size={12} /> Excluir
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-6 border border-white/5">
                <Bell size={32} className="text-gray-600" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Sem notificações</h3>
              <p className="text-sm text-gray-500 max-w-xs font-light">
                Tudo limpo por aqui! Você será avisado quando houver novas atividades.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/5 bg-[#0a0a1a]/50 flex items-center justify-between relative z-20">
          <span className="text-[11px] text-[#6e6e6e] font-medium tracking-tight">
            Total: {notifications.length}
          </span>
          <div className="flex items-center space-x-2">
            <div className="w-1.5 h-1.5 bg-primary rounded-full shadow-[0_0_5px_rgba(99,102,241,0.5)]"></div>
            <span className="text-[11px] text-[#6e6e6e] font-medium tracking-tight">
              {notifications.filter(n => n.unread).length} não lidas
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationsHistoryModal;
