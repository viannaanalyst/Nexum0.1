import React, { useState, useEffect } from 'react';
import {
  Bug,
  Lightbulb,
  Clock,
  Search,
  Plus,
  MessageSquare,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  ImageIcon,
  Loader2,
  CalendarDays
} from 'lucide-react';
import { addBusinessDays, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useCompany } from '../../context/CompanyContext';
import SupportTicketModal from '../../components/SupportTicketModal';

const Suporte = () => {
  const { user } = useAuth();
  const { selectedCompany } = useCompany();
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [supportModalOpen, setSupportModalOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<any>(null);

  const fetchTickets = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('support_tickets')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTickets(data || []);
    } catch (error) {
      console.error('Error fetching tickets:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();

    const handleOpenTicket = () => {
      setSelectedTicket(null);
      setSupportModalOpen(true);
    };
    window.addEventListener('open-support-ticket', handleOpenTicket);
    return () => window.removeEventListener('open-support-ticket', handleOpenTicket);
  }, [user]);

  const filteredTickets = tickets.filter(ticket =>
    ticket.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ticket.type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'in_progress':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'resolved':
        return 'bg-green-500/10 text-green-400 border-green-500/20';
      case 'closed':
        return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
      default:
        return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'open': return 'Aberto';
      case 'in_progress': return 'Em Progresso';
      case 'resolved': return 'Resolvido';
      case 'closed': return 'Fechado';
      default: return status;
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total', count: tickets.length, icon: <MessageSquare size={20} />, color: 'primary' },
          { label: 'Abertos', count: tickets.filter(t => t.status === 'open' || t.status === 'in_progress').length, icon: <Clock size={20} />, color: 'amber' },
          { label: 'Resolvidos', count: tickets.filter(t => t.status === 'resolved').length, icon: <CheckCircle2 size={20} />, color: 'green' },
          { label: 'Bugs', count: tickets.filter(t => t.type === 'bug').length, icon: <Bug size={20} />, color: 'red' },
        ].map((stat, i) => (
          <div key={i} className="glass-card p-6 rounded-2xl border border-white/5 flex items-center space-x-4">
            <div className={`p-3 rounded-xl bg-${stat.color}-500/10 text-${stat.color}-400 border border-${stat.color}-500/20`}>
              {stat.icon}
            </div>
            <div>
              <p className="text-xs text-gray-400 font-bold">{stat.label}</p>
              <p className="text-2xl font-bold text-white">{stat.count}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters and List */}
      <div className="space-y-4">
        <div className="relative max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
          <input
            type="text"
            placeholder="Pesquisar por descrição ou tipo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white/[0.03] hover:bg-white/[0.05] border border-white/10 rounded-xl py-3 pl-12 pr-4 text-sm text-white focus:bg-white/[0.05] focus:border-primary/50 focus:ring-0 outline-none transition-all placeholder-gray-600"
          />
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-500 space-y-4">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <p className="font-light">Carregando seus chamados...</p>
          </div>
        ) : filteredTickets.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {filteredTickets.map((ticket) => (
              <div
                key={ticket.id}
                onClick={() => {
                  setSelectedTicket(ticket);
                  setSupportModalOpen(true);
                }}
                className="glass-card rounded-2xl border border-white/5 hover:border-white/10 transition-all duration-300 group overflow-hidden flex flex-col cursor-pointer hover:bg-white/[0.02]"
              >
                {/* Header with Type, Date and Deadline */}
                <div className="p-5 border-b border-white/5 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-lg ${ticket.type === 'bug' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-primary/10 text-primary border-primary/20'}`}>
                      {ticket.type === 'bug' ? <Bug size={16} /> : <Lightbulb size={16} />}
                    </div>
                    <div>
                      <p className={`text-[11px] font-bold ${ticket.type === 'bug' ? 'text-red-400' : 'text-primary'}`}>
                        {ticket.type === 'bug' ? 'Bug' : 'Melhoria'}
                      </p>
                      <p className="text-[10px] text-gray-500">{format(new Date(ticket.created_at), "dd 'de' MMM", { locale: ptBR })}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-[9px] text-gray-500 font-bold tracking-tight opacity-60">Prazo estimado</p>
                      <p className="text-[11px] font-bold text-amber-500/90 flex items-center gap-1 justify-end">
                        <Clock size={11} className="animate-pulse" />
                        {format(addBusinessDays(new Date(ticket.created_at), 3), 'dd/MM/yy')}
                      </p>
                    </div>

                    {ticket.screenshot_url && (
                      <a
                        href={ticket.screenshot_url}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-gray-500 hover:text-white transition-all"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ImageIcon size={14} />
                      </a>
                    )}
                  </div>
                </div>

                {/* Content */}
                <div className="p-5 flex-1 space-y-2">
                  <h4 className="text-sm font-bold text-white line-clamp-1 group-hover:text-primary transition-colors">
                    {ticket.title || 'Sem título'}
                  </h4>
                  <p className="text-xs text-gray-500 line-clamp-3 leading-relaxed">
                    {ticket.description}
                  </p>
                </div>

                {/* Footer with Status */}
                <div className="p-5 pt-0 mt-auto flex items-center justify-between">
                  <span className={`px-3 py-1 rounded-full text-[10px] font-bold border ${getStatusStyle(ticket.status)}`}>
                    {getStatusLabel(ticket.status)}
                  </span>
                  <button className="text-gray-600 hover:text-white transition-colors">
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 bg-white/[0.02] border border-dashed border-white/10 rounded-[22px]">
            <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-4 text-gray-700">
              <MessageSquare size={32} />
            </div>
            <h3 className="text-lg font-medium text-gray-400">Nenhum chamado encontrado</h3>
            <p className="text-sm text-gray-600 mt-1 max-w-xs mx-auto">
              {searchTerm ? 'Tente mudar o termo da pesquisa.' : 'Crie seu primeiro chamado clicando no botão abaixo.'}
            </p>
          </div>
        )}
      </div>

      <SupportTicketModal
        isOpen={supportModalOpen}
        ticket={selectedTicket}
        onClose={() => {
          setSupportModalOpen(false);
          setSelectedTicket(null);
          fetchTickets(); // Refresh list after closing
        }}
      />
    </div>
  );
};

export default Suporte;
