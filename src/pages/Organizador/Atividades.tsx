import React, { useState, useEffect, useMemo } from 'react';
import { 
  Activity, 
  MessageSquare, 
  CheckCircle2, 
  ArrowRight, 
  FileText, 
  User, 
  Calendar, 
  Filter,
  Search,
  Move,
  Trash2,
  AlertCircle
} from 'lucide-react';
import { useCompany } from '../../context/CompanyContext';
import { supabase } from '../../lib/supabase';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// --- Tipos ---
interface AuditLog {
  id: string;
  user_id: string;
  action_type: 'create' | 'update' | 'delete' | 'comment' | 'move' | 'approve' | 'archive';
  entity_type: 'card' | 'client' | 'column' | 'checklist' | 'file';
  entity_id: string;
  details: any; // JSONB
  created_at: string;
  user?: {
    full_name: string;
    email: string;
    avatar_url?: string;
  };
}

const OrganizadorAtividades = () => {
  const { selectedCompany } = useCompany();
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [filterType, setFilterType] = useState<string>('all'); // all, kanban, comments, approvals
  const [searchTerm, setSearchTerm] = useState('');
  const [displayLimit, setDisplayLimit] = useState(10);

  useEffect(() => {
    if (selectedCompany) fetchLogs();
  }, [selectedCompany]);

  // Realtime Subscription
  useEffect(() => {
    if (!selectedCompany) return;

    const channel = supabase
      .channel('audit-logs-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'audit_logs',
          filter: `company_id=eq.${selectedCompany.id}`
        },
        (payload) => {
          console.log('New log received:', payload);
          // Fetch user details for the new log if needed, or just prepend with basic info
          // For simplicity, let's re-fetch or append optimistically
          // Appending optimistically is hard because we need user info.
          // Let's just re-fetch the latest 1 log and prepend.
          fetchNewLog(payload.new.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedCompany]);

  const fetchNewLog = async (id: string) => {
      try {
        const { data } = await supabase
            .from('audit_logs')
            .select(`
                *,
                user:profiles ( full_name, email )
            `)
            .eq('id', id)
            .single();
        
        if (data) {
            // @ts-ignore
            setLogs(prev => [data, ...prev]);
        }
      } catch (error) {
          console.error("Error fetching new log", error);
      }
  }

  const fetchLogs = async () => {
    if (!selectedCompany) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select(`
          *,
          user:profiles ( full_name, email ) -- Join with profiles table (aliased as user)
        `)
        .eq('company_id', selectedCompany.id)
        .order('created_at', { ascending: false })
        .limit(100) as any; // Pagination recommended for production

      if (error) throw error;
      
      // If the relation isn't set up in Supabase, we might need manual fetch. 
      // Assuming 'user_id' in audit_logs points to auth.users, we can't join directly unless we have a public profile table.
      // Let's assume we have a 'profiles' table and the relation is correct.
      // If fetch fails on relation, fallback to manual user fetch.
      
      // Manual User Fetch Fallback (if join fails or returns null)
      if (data) {
          const logsWithUsers = await Promise.all(data.map(async (log: any) => {
              if (log.user) return log;
              
              // Fallback
              if (log.user_id) {
                  const { data: profile } = await supabase.from('profiles').select('full_name, email').eq('id', log.user_id).single();
                  return { ...log, user: profile };
              }
              return { ...log, user: { full_name: 'Sistema', email: 'system@nexum.com' } };
          }));
          // @ts-ignore
          setLogs(logsWithUsers);
      }
      
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const matchesSearch = 
        log.details?.card_title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.user?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.action_type.toLowerCase().includes(searchTerm.toLowerCase());
      
      if (filterType === 'all') return matchesSearch;
      if (filterType === 'kanban') return matchesSearch && ['move', 'create', 'delete'].includes(log.action_type);
      if (filterType === 'comments') return matchesSearch && log.action_type === 'comment';
      if (filterType === 'approvals') return matchesSearch && log.action_type === 'approve';
      
      return matchesSearch;
    });
  }, [logs, filterType, searchTerm]);

  const getActionIcon = (type: string) => {
    switch (type) {
      case 'create': return <div className="bg-green-500/20 text-green-400 p-2 rounded-full"><FileText size={16} /></div>;
      case 'move': return <div className="bg-blue-500/20 text-blue-400 p-2 rounded-full"><Move size={16} /></div>;
      case 'comment': return <div className="bg-yellow-500/20 text-yellow-400 p-2 rounded-full"><MessageSquare size={16} /></div>;
      case 'approve': return <div className="bg-purple-500/20 text-purple-400 p-2 rounded-full"><CheckCircle2 size={16} /></div>;
      case 'delete': return <div className="bg-red-500/20 text-red-400 p-2 rounded-full"><Trash2 size={16} /></div>;
      default: return <div className="bg-gray-500/20 text-gray-400 p-2 rounded-full"><Activity size={16} /></div>;
    }
  };

  const getActionDescription = (log: AuditLog) => {
    const { action_type, details, user } = log;
    const userName = user?.full_name || user?.email || 'Alguém';
    const cardTitle = details?.card_title || 'um card';

    switch (action_type) {
      case 'create':
        return (
          <span>
            <span className="font-bold text-white">{userName}</span> criou o card <span className="font-bold text-white">"{cardTitle}"</span>{details?.column_title ? <span> na coluna <span className="text-gray-400">{details.column_title}</span></span> : ''}.
          </span>
        );
      case 'update':
          if (details?.field === 'assigned_to') {
              return (
                  <span>
                      <span className="font-bold text-white">{userName}</span> alterou o responsável de <span className="font-bold text-white">"{cardTitle}"</span> de <span className="text-gray-400 line-through mx-1">{details.from}</span> para <span className="text-primary font-bold">{details.to}</span>.
                  </span>
              );
          }
          if (details?.field === 'due_date') {
               return (
                  <span>
                      <span className="font-bold text-white">{userName}</span> alterou a data de <span className="font-bold text-white">"{cardTitle}"</span> para <span className="text-primary font-bold">{details.to}</span>.
                  </span>
              );
          }
          if (details?.action === 'file_upload') {
               return (
                  <span>
                      <span className="font-bold text-white">{userName}</span> anexou o arquivo <span className="text-primary font-bold">{details.file_name}</span> em <span className="font-bold text-white">"{cardTitle}"</span>.
                  </span>
              );
          }
          return <span>Atualização em "{cardTitle}": {JSON.stringify(details)}</span>;
      case 'move':
        return (
          <span>
            <span className="font-bold text-white">{userName}</span> moveu <span className="font-bold text-white">"{cardTitle}"</span> de <span className="text-gray-400 line-through mx-1">{details?.from}</span> para <span className="text-primary font-bold">{details?.to}</span>.
          </span>
        );
      case 'comment':
        return (
          <span>
            <span className="font-bold text-white">{userName}</span> comentou em <span className="font-bold text-white">"{cardTitle}"</span>:
            <p className="mt-1 text-gray-400 italic text-sm border-l-2 border-gray-600 pl-2 line-clamp-2">"{details?.content}"</p>
          </span>
        );
      case 'approve':
        return (
          <span>
            <span className="font-bold text-white">{userName}</span> {details?.status === 'approved' ? 'aprovou' : 'solicitou aprovação'} no card <span className="font-bold text-white">"{cardTitle}"</span>.
          </span>
        );
      case 'delete':
        return (
          <span>
            <span className="font-bold text-white">{userName}</span> excluiu o card <span className="font-bold text-white">"{cardTitle}"</span>.
          </span>
        );
      default:
        return <span>{JSON.stringify(details)}</span>;
    }
  };

  if (loading) return <div className="p-8 text-white">Carregando feed de atividades...</div>;

  return (
    <div className="p-8 h-full flex flex-col max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400">Feed de Atividades</h1>
          <p className="text-gray-400 mt-2">Diário de bordo operacional em tempo real.</p>
        </div>
        
        {/* Filtros */}
        <div className="flex items-center gap-3 bg-white/5 p-1.5 rounded-xl border border-white/10">
          <button 
            onClick={() => setFilterType('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${filterType === 'all' ? 'bg-primary text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
          >
            Tudo
          </button>
          <button 
            onClick={() => setFilterType('kanban')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${filterType === 'kanban' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'text-gray-400 hover:text-white'}`}
          >
            <Move size={14} /> Movimentações
          </button>
          <button 
            onClick={() => setFilterType('comments')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${filterType === 'comments' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' : 'text-gray-400 hover:text-white'}`}
          >
            <MessageSquare size={14} /> Comentários
          </button>
          <button 
            onClick={() => setFilterType('approvals')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${filterType === 'approvals' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'text-gray-400 hover:text-white'}`}
          >
            <CheckCircle2 size={14} /> Aprovações
          </button>
        </div>
      </div>

      <div className="mb-6 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
          <input 
            type="text" 
            placeholder="Buscar por usuário, card ou ação..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white focus:outline-none focus:border-primary transition-all"
          />
      </div>

      {/* Timeline */}
      <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-white/10 before:to-transparent">
        {filteredLogs.length > 0 ? (
          <>
            {filteredLogs.slice(0, displayLimit).map((log) => (
              <div key={log.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                
                {/* Icon Marker */}
                <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white/10 bg-[#0a0a1a] shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                  {getActionIcon(log.action_type)}
                </div>
                
                {/* Content Card */}
                <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-[#0f0f1a] p-5 rounded-xl border border-white/5 hover:border-primary/30 transition-all shadow-lg hover:shadow-primary/5">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {log.user?.avatar_url ? (
                          <img src={log.user.avatar_url} alt={log.user.full_name} className="w-6 h-6 rounded-full" />
                      ) : (
                          <div className="w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center text-white text-[10px] font-bold">
                              {(log.user?.full_name || log.user?.email || '?').charAt(0).toUpperCase()}
                          </div>
                      )}
                      <span className="text-xs text-gray-400 font-medium">
                          {formatDistanceToNow(new Date(log.created_at), { addSuffix: true, locale: ptBR })}
                      </span>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded uppercase font-bold tracking-wider 
                      ${log.entity_type === 'card' ? 'bg-blue-500/10 text-blue-400' : 
                        log.entity_type === 'client' ? 'bg-green-500/10 text-green-400' : 'bg-gray-500/10 text-gray-400'}`}>
                      {log.entity_type}
                    </span>
                  </div>
                  
                  <div className="text-sm text-gray-300 leading-relaxed">
                    {getActionDescription(log)}
                  </div>
                </div>
              </div>
            ))}
            
            {filteredLogs.length > displayLimit && (
                <div className="flex justify-center pt-8 relative z-10">
                    <button 
                        onClick={() => setDisplayLimit(prev => prev + 20)}
                        className="px-6 py-2.5 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-xl border border-white/5 transition-all text-sm font-medium flex items-center gap-2 backdrop-blur-md"
                    >
                        <ArrowRight size={16} className="rotate-90" />
                        Ver mais histórico
                    </button>
                </div>
            )}
          </>
        ) : (
          <div className="text-center py-12">
            <div className="bg-white/5 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-500">
              <Activity size={32} />
            </div>
            <h3 className="text-white font-bold text-lg">Nenhuma atividade registrada</h3>
            <p className="text-gray-500 mt-2">As ações realizadas no quadro aparecerão aqui.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default OrganizadorAtividades;
