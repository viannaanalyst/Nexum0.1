import React, { useState, useMemo, useEffect } from 'react';
import { 
  Search, Calendar, MessageCircle, Mail, 
  CheckCircle2, Clock, AlertCircle, Send,
  LayoutGrid, List as ListIcon, Filter
} from 'lucide-react';
import { useCompany } from '../../context/CompanyContext';
import { supabase } from '../../lib/supabase';

// Types
interface Client {
  id: string;
  name: string;
  mrr: number;
  due_day: number;
  status: 'active' | 'paused' | 'canceled';
  phone?: string;
  email?: string;
}

interface Transaction {
  client_id: string;
  status: string;
  due_date: string;
}

interface Notification {
  client_id: string;
  type: 'reminder_3d' | 'due_today' | 'overdue';
  sent_at: string;
}

const FinanceiroCobranca = () => {
  const { selectedCompany } = useCompany();
  const [view, setView] = useState<'status' | 'flow'>('status');
  const [searchTerm, setSearchTerm] = useState('');
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  
  // Data States
  const [clients, setClients] = useState<Client[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // Fetch Data
  const fetchData = async () => {
    if (!selectedCompany) return;
    setLoading(true);
    try {
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const endDate = new Date(year, month, 0).toISOString().split('T')[0];

      const [clientsRes, transRes, notifRes] = await Promise.all([
        supabase.from('clients').select('*').eq('company_id', selectedCompany.id).eq('status', 'active'),
        supabase.from('transactions').select('*').eq('company_id', selectedCompany.id).gte('due_date', startDate).lte('due_date', endDate),
        supabase.from('billing_notifications').select('*').eq('company_id', selectedCompany.id).eq('month', month).eq('year', year)
      ]);

      setClients(clientsRes.data || []);
      setTransactions(transRes.data || []);
      setNotifications(notifRes.data || []);
    } catch (error) {
      console.error('Error fetching billing data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [selectedCompany, month, year]);

  // Logic: Categorize Clients
  const billingStats = useMemo(() => {
    const today = new Date().getDate();
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();

    const categorized = {
      overdue: [] as Client[],
      dueToday: [] as Client[],
      paid: [] as Client[]
    };

    clients
      .filter(client => client.name.toLowerCase().includes(searchTerm.toLowerCase()))
      .forEach(client => {
        const payment = transactions.find(t => t.client_id === client.id && t.status === 'paid');
        
        // Logic for "Overdue" depends on current date vs due date
        // If we are looking at a past month, anyone without payment is overdue
        // If current month, only if due_day < today
        
        if (payment) {
          categorized.paid.push(client);
        } else {
          const isPastDue = 
            (year < currentYear) || 
            (year === currentYear && month < currentMonth) ||
            (year === currentYear && month === currentMonth && client.due_day < today);
            
          const isDueToday = 
            (year === currentYear && month === currentMonth && client.due_day === today);

          if (isDueToday) {
            categorized.dueToday.push(client);
          } else if (isPastDue) {
            categorized.overdue.push(client);
          } else {
            // Future due date in current month or future month
            // We can treat them as "Pending" (not shown in Overdue/Today/Paid columns explicitly, 
            // maybe add a 'Pending' column or just ignore for Kanban focused on action)
            // For now, let's add a 'Pending' bucket implicitly or show in Flow view
          }
        }
      });

    return categorized;
  }, [clients, transactions, month, year, searchTerm]);

  // Actions
  const handleSendNotification = async (client: Client, type: 'reminder_3d' | 'due_today' | 'overdue') => {
    try {
      if (!selectedCompany) return;

      const { error } = await supabase.from('billing_notifications').insert({
        company_id: selectedCompany.id,
        client_id: client.id,
        month,
        year,
        type,
        sent_by: (await supabase.auth.getUser()).data.user?.id
      });

      if (error) throw error;
      
      // Here we would integrate with WhatsApp/Email API
      // For now, just simulate success
      alert(`Notificação enviada para ${client.name}!`);
      fetchData();
    } catch (error) {
      console.error('Error sending notification:', error);
      alert('Erro ao registrar envio.');
    }
  };

  const getWhatsAppLink = (client: Client) => {
    if (!client.phone) return '#';
    const message = `Olá ${client.name}, lembrete da sua fatura com vencimento dia ${client.due_day}/${month}.`;
    return `https://wa.me/${client.phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
  };

  const getMailToLink = (client: Client) => {
    if (!client.email) return '#';
    const subject = `Fatura Nexum - Vencimento ${client.due_day}/${month}`;
    const body = `Olá ${client.name},\n\nSegue lembrete de pagamento...`;
    return `mailto:${client.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  if (!selectedCompany) return <div className="text-white p-8">Selecione uma empresa.</div>;

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto">
      {/* Header & Filtros */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-6">
        <div>
          <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400">
            CRM de Cobrança
          </h1>
          <p className="text-gray-400 mt-1">Gestão de inadimplência e régua de relacionamento.</p>
        </div>

        <div className="flex items-center gap-4 bg-white/5 p-1 rounded-2xl border border-white/10">
          <button 
            onClick={() => setView('status')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${view === 'status' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-gray-400 hover:text-white'}`}
          >
            <LayoutGrid size={18} /> <span>Status</span>
          </button>
          <button 
            onClick={() => setView('flow')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${view === 'flow' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-gray-400 hover:text-white'}`}
          >
            <ListIcon size={18} /> <span>Fluxo de Envios</span>
          </button>
        </div>
      </div>

      {/* Busca e Resumo Rápido */}
      <div className="flex flex-col md:flex-row gap-6">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
          <input 
            type="text" 
            placeholder="Buscar cliente por nome..."
            className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-white focus:outline-none focus:border-primary transition-colors"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex gap-4">
            <SummaryMiniCard label="Pagos" count={billingStats.paid.length} color="text-emerald-400" bg="bg-emerald-400/10" />
            <SummaryMiniCard label="Vence Hoje" count={billingStats.dueToday.length} color="text-blue-400" bg="bg-blue-400/10" />
            <SummaryMiniCard label="Atrasados" count={billingStats.overdue.length} color="text-pink-400" bg="bg-pink-400/10" />
        </div>
      </div>

      {/* Visão Kanban de Status */}
      {view === 'status' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <BillingColumn 
            title="Inadimplentes" 
            color="border-pink-500/30" 
            icon={<AlertCircle className="text-pink-400" />} 
            clients={billingStats.overdue} 
            type="overdue" 
            onWhatsApp={getWhatsAppLink}
            onEmail={getMailToLink}
          />
          <BillingColumn 
            title="Vence Hoje" 
            color="border-blue-500/30" 
            icon={<Clock className="text-blue-400" />} 
            clients={billingStats.dueToday} 
            type="today" 
            onWhatsApp={getWhatsAppLink}
            onEmail={getMailToLink}
          />
          <BillingColumn 
            title="Pagos" 
            color="border-emerald-500/30" 
            icon={<CheckCircle2 className="text-emerald-400" />} 
            clients={billingStats.paid} 
            type="paid" 
            onWhatsApp={getWhatsAppLink}
            onEmail={getMailToLink}
          />
        </div>
      )}

      {/* Visão de Tabela Flow */}
      {view === 'flow' && (
        <div className="glass-card rounded-3xl border border-white/10 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/5 text-gray-400 text-xs uppercase tracking-widest">
                <th className="px-6 py-4 font-medium">Cliente</th>
                <th className="px-6 py-4 font-medium text-center">Lembrete (3d)</th>
                <th className="px-6 py-4 font-medium text-center">Dia do Vencimento</th>
                <th className="px-6 py-4 font-medium text-center">Aviso de Atraso</th>
                <th className="px-6 py-4 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-gray-300">
              {clients.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase())).map(client => {
                const sentReminder = notifications.find(n => n.client_id === client.id && n.type === 'reminder_3d');
                const sentToday = notifications.find(n => n.client_id === client.id && n.type === 'due_today');
                const sentOverdue = notifications.find(n => n.client_id === client.id && n.type === 'overdue');

                return (
                  <tr key={client.id} className="hover:bg-white/5 transition-colors group">
                    <td className="px-6 py-4 font-medium text-white">{client.name}</td>
                    <td className="px-6 py-4 text-center">
                      <NotificationStatus status={sentReminder ? 'sent' : 'pending'} />
                    </td>
                    <td className="px-6 py-4 text-center">
                      <NotificationStatus status={sentToday ? 'sent' : 'pending'} />
                    </td>
                    <td className="px-6 py-4 text-center">
                      <NotificationStatus status={sentOverdue ? 'sent' : 'pending'} />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => handleSendNotification(client, 'due_today')}
                        className="p-2 bg-primary/10 text-primary rounded-lg hover:bg-primary hover:text-white transition-all opacity-0 group-hover:opacity-100"
                        title="Registrar envio manual"
                      >
                        <Send size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// Sub-componentes
const SummaryMiniCard = ({ label, count, color, bg }: { label: string, count: number, color: string, bg: string }) => (
  <div className={`px-6 py-2 rounded-2xl ${bg} border border-white/5 flex flex-col items-center justify-center min-w-[100px]`}>
    <span className={`text-2xl font-black ${color}`}>{count}</span>
    <span className="text-[10px] uppercase text-gray-500 font-bold">{label}</span>
  </div>
);

const BillingColumn = ({ title, color, icon, clients, type, onWhatsApp, onEmail }: any) => (
  <div className={`glass-card p-6 rounded-3xl border-t-4 ${color} flex flex-col h-[600px]`}>
    <div className="flex items-center gap-3 mb-6">
      {icon}
      <h3 className="text-lg font-bold text-white">{title}</h3>
      <span className="ml-auto bg-white/5 px-2 py-1 rounded text-xs text-gray-500 font-bold">{clients.length}</span>
    </div>
    <div className="space-y-4 overflow-y-auto flex-1 pr-2 custom-scrollbar">
      {clients.map((client: Client) => (
        <ClientBillingCard 
          key={client.id} 
          client={client} 
          type={type} 
          whatsappLink={onWhatsApp(client)}
          emailLink={onEmail(client)}
        />
      ))}
      {clients.length === 0 && (
        <div className="text-center py-8 text-gray-600 italic text-sm">
          Nenhum cliente nesta lista.
        </div>
      )}
    </div>
  </div>
);

const ClientBillingCard = ({ client, type, whatsappLink, emailLink }: any) => (
  <div className="bg-white/5 p-4 rounded-2xl border border-white/5 hover:border-white/10 transition-all group">
    <div className="flex justify-between items-start mb-3">
      <p className="text-white font-bold text-sm truncate max-w-[150px]">{client.name}</p>
      <div className={`w-2 h-2 rounded-full ${type === 'overdue' ? 'bg-pink-500 shadow-[0_0_8px_#ec4899]' : type === 'today' ? 'bg-blue-500 shadow-[0_0_8px_#3b82f6]' : 'bg-emerald-500 shadow-[0_0_8px_#10b981]'}`} />
    </div>
    <div className="flex justify-between items-end">
      <div>
        <p className="text-xs text-gray-500">Mensalidade</p>
        <p className="text-white font-black">R$ {client.mrr?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
      </div>
      <div className="flex gap-2">
        <a 
          href={whatsappLink}
          target="_blank"
          rel="noopener noreferrer"
          className="p-2 bg-green-500/10 text-green-400 rounded-xl hover:bg-green-500 hover:text-white transition-all"
          title="Enviar WhatsApp"
        >
          <MessageCircle size={16} />
        </a>
        <a 
          href={emailLink}
          className="p-2 bg-blue-500/10 text-blue-400 rounded-xl hover:bg-blue-500 hover:text-white transition-all"
          title="Enviar E-mail"
        >
          <Mail size={16} />
        </a>
      </div>
    </div>
  </div>
);

const NotificationStatus = ({ status }: { status: 'sent' | 'pending' | 'none' }) => {
  if (status === 'sent') return <div className="flex justify-center"><CheckCircle2 size={18} className="text-emerald-500" /></div>;
  if (status === 'pending') return <div className="flex justify-center"><Clock size={18} className="text-gray-600" /></div>;
  return <div className="flex justify-center"><div className="w-4 h-4 rounded-full border-2 border-white/10" /></div>;
};

export default FinanceiroCobranca;
