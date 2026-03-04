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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md transition-all duration-300">
      <div className="relative w-full max-w-2xl h-[600px] flex flex-col glass-card border border-white/10 bg-[#0a0a1a]/95 shadow-[0_0_50px_rgba(0,0,0,0.5)] rounded-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-primary/20 text-primary">
              <Bell size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Histórico de Notificações</h2>
              <p className="text-xs text-gray-500">Acompanhe todas as atividades recentes</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {hasUnread && (
              <button 
                onClick={onMarkAllAsRead}
                className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-all text-[10px] font-bold uppercase tracking-wider"
              >
                <Check size={14} />
                <span>Marcar todas como lidas</span>
              </button>
            )}
            <button 
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white transition-colors rounded-full hover:bg-white/5"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-white/10">
          {notifications.length > 0 ? (
            <div className="space-y-4">
              {notifications.map((notification) => (
                <div 
                  key={notification.id} 
                  className={`p-5 rounded-2xl border transition-all duration-200 group relative ${
                    notification.unread 
                      ? 'bg-primary/5 border-primary/20 shadow-[0_0_20px_rgba(99,102,241,0.05)]' 
                      : 'bg-white/[0.02] border-white/5 hover:border-white/10'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1 min-w-0 pr-4">
                      <div className="flex items-center space-x-2 mb-1">
                        {notification.unread && (
                          <span className="w-2 h-2 bg-primary rounded-full shadow-[0_0_10px_rgba(99,102,241,1)]"></span>
                        )}
                        <h4 className={`text-sm font-bold truncate ${notification.unread ? 'text-white' : 'text-gray-300'}`}>
                          {notification.title}
                        </h4>
                      </div>
                      <p className="text-xs text-gray-400 leading-relaxed group-hover:text-gray-300 transition-colors">
                        {notification.description}
                      </p>
                    </div>
                    <div className="flex items-center space-x-3 shrink-0">
                      <div className="flex items-center text-[10px] text-gray-500">
                        <Clock size={12} className="mr-1" />
                        {formatDate(notification.created_at)}
                      </div>
                      <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {notification.unread && (
                          <button 
                            onClick={() => onMarkAsRead(notification.id)}
                            className="p-1.5 text-primary hover:bg-primary/10 rounded-lg transition-colors"
                            title="Marcar como lida"
                          >
                            <Check size={14} />
                          </button>
                        )}
                        <button 
                          onClick={() => onDelete(notification.id)}
                          className="p-1.5 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                          title="Excluir"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-4">
                <Bell size={32} className="text-gray-600" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Sem notificações</h3>
              <p className="text-sm text-gray-500 max-w-xs">
                Tudo limpo por aqui! Você será avisado quando houver novas atividades.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 bg-white/[0.02] flex items-center justify-between">
          <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">
            Total: {notifications.length} notificações
          </p>
          <div className="flex items-center space-x-2">
             <div className="w-2 h-2 bg-primary rounded-full"></div>
             <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">
               {notifications.filter(n => n.unread).length} não lidas
             </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationsHistoryModal;
