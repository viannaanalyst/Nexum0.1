import React, { useState, useMemo, useEffect } from 'react';
import {
  Plus,
  Search,
  Calendar,
  CheckCircle,
  Clock,
  AlertCircle,
  MoreVertical,
  TrendingUp,
  TrendingDown,
  Trash2,
  Edit2,
  X
} from 'lucide-react';
import { useCompany } from '../../context/CompanyContext';
import { supabase } from '../../lib/supabase';
import { Select } from '../../components/ui/Select';
import { useUI } from '../../context/UIContext';
import { IMaskInput } from 'react-imask';

// Types
interface Transaction {
  id: string;
  description: string;
  type: 'income' | 'expense';
  amount: number;
  category: string;
  due_date: string;
  status: 'paid' | 'pending' | 'overdue';
  client_id?: string;
  is_virtual?: boolean;
  recurrence: 'none' | 'monthly';
  recurrence_until?: string | null;
  template_id?: string | null;
}

interface Client {
  id: string;
  name: string;
  mrr: number;
  due_day: number;
  status: 'active' | 'paused' | 'canceled';
  start_date?: string;
  end_date?: string;
}

const FinanceiroLancamentos = () => {
  const { selectedCompany } = useCompany();
  const { confirm, toast } = useUI();
  const [selectedMonths, setSelectedMonths] = useState<number[]>([new Date().getMonth() + 1]);
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>(['all']);
  const [year, setYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // New Transaction Form State
  const [newTransaction, setNewTransaction] = useState<Partial<Transaction>>({
    type: 'expense',
    status: 'pending',
    category: 'Outros',
    due_date: new Date().toISOString().split('T')[0],
    recurrence: 'none',
    recurrence_until: null,
    client_id: undefined,
    template_id: null
  });

  // Fetch Data (Yearly to support multiple months in memory)
  const fetchData = async () => {
    if (!selectedCompany) return;
    setLoading(true);
    try {
      const startOfYear = `${year}-01-01`;
      const endOfYear = `${year}-12-31`;

      const [transRes, clientsRes] = await Promise.all([
        supabase
          .from('transactions')
          .select('*')
          .eq('company_id', selectedCompany.id)
          .gte('due_date', startOfYear)
          .lte('due_date', endOfYear),
        supabase
          .from('clients')
          .select('id, name, mrr, due_day, status, start_date, end_date')
          .eq('company_id', selectedCompany.id)
          .eq('status', 'active')
      ]);

      setTransactions(transRes.data || []);
      setClients(clientsRes.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [selectedCompany, year]);

  useEffect(() => {
    const handleGlobalNewTransaction = () => {
      setEditingId(null);
      setNewTransaction({
        type: 'expense',
        status: 'pending',
        category: 'Outros',
        due_date: new Date().toISOString().split('T')[0],
        recurrence: 'none',
        recurrence_until: null,
        client_id: undefined,
        template_id: null
      });
      setIsModalOpen(true);
    };

    window.addEventListener('open-new-transaction', handleGlobalNewTransaction);
    return () => window.removeEventListener('open-new-transaction', handleGlobalNewTransaction);
  }, []);

  // Logic: Merge Real Transactions + Virtual MRR
  const displayData = useMemo(() => {
    const isAllMonths = selectedMonths.includes('all' as any) || selectedMonths.length === 0;
    const effectiveMonths = isAllMonths ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] : selectedMonths;
    const isAllClients = selectedClientIds.includes('all') || selectedClientIds.length === 0;

    let combined: Transaction[] = [];

    // Filter real transactions by selected months and clients
    const filteredRealTransactions = transactions.filter(t => {
      const tMonth = parseInt(t.due_date.split('-')[1], 10);
      const tYear = parseInt(t.due_date.split('-')[0], 10);
      const monthMatch = effectiveMonths.includes(tMonth) && tYear === year;
      const clientMatch = isAllClients || (t.client_id && selectedClientIds.includes(t.client_id));
      return monthMatch && clientMatch;
    });

    combined = [...filteredRealTransactions];

    effectiveMonths.forEach(m => {
      const currentMonthTransactions = filteredRealTransactions.filter(t => {
        const tMonth = parseInt(t.due_date.split('-')[1], 10);
        return tMonth === m;
      });

      const monthEndDate = new Date(year, m, 0).toISOString().split('T')[0];
      const monthStartDate = `${year}-${String(m).padStart(2, '0')}-01`;

      // 1. FILTRAR RECORRÊNCIAS MANUAIS (TEMPLATES) PARA ESTE MÊS
      const monthTemplates = transactions.filter(t => t.recurrence === 'monthly' && !t.template_id).filter(template => {
        if (template.due_date > monthEndDate) return false;
        if (template.recurrence_until && template.recurrence_until < monthStartDate) return false;

        // Verifica se já existe uma instância real
        const hasRealInstance = transactions.some(t =>
          t.template_id === template.id &&
          t.due_date.startsWith(`${year}-${String(m).padStart(2, '0')}`)
        );
        const isOriginalMonth = template.due_date.split('-')[0] === String(year) && parseInt(template.due_date.split('-')[1]) === m;

        return !hasRealInstance && !isOriginalMonth;
      });

      // 2. COLETAR CLIENTES QUE JÁ TÊM LANÇAMENTO (REAL OU VIRTUAL)
      const clientsWithActivity = new Set([
        ...currentMonthTransactions
          .filter(t => t.type === 'income' && t.client_id)
          .map(t => t.client_id as string),
        ...monthTemplates
          .filter(t => t.type === 'income' && t.client_id)
          .map(t => t.client_id as string)
      ]);

      // 3. GERAR MRR APENAS SE NÃO HOUVER NADA AINDA
      clients.forEach((client) => {
        if (!isAllClients && !selectedClientIds.includes(client.id)) return;
        if (client.start_date && client.start_date > monthEndDate) return;
        if (client.end_date && client.end_date !== '' && client.end_date < monthStartDate) return;

        if (!clientsWithActivity.has(client.id)) {
          const daysInMonth = new Date(year, m, 0).getDate();
          const actualDay = Math.min(client.due_day, daysInMonth);
          const dueDate = `${year}-${String(m).padStart(2, '0')}-${String(actualDay).padStart(2, '0')}`;
          const isOverdue = new Date(dueDate) < new Date() && (new Date().getMonth() + 1 > m || (new Date().getMonth() + 1 === m && new Date().getDate() > actualDay));

          combined.push({
            id: `virtual-mrr-${client.id}-${m}`,
            description: `Mensalidade: ${client.name}`,
            type: 'income',
            amount: client.mrr,
            category: 'Contrato MRR',
            due_date: dueDate,
            status: isOverdue ? 'overdue' : 'pending',
            client_id: client.id,
            is_virtual: true,
            recurrence: 'none'
          });
        }
      });

      // 4. ADICIONAR AS RECORRÊNCIAS VIRTUAIS AO COMBINED
      monthTemplates.forEach(template => {
        const originalDay = parseInt(template.due_date.split('-')[2]);
        const daysInMonth = new Date(year, m, 0).getDate();
        const actualDay = Math.min(originalDay, daysInMonth);
        const dueDate = `${year}-${String(m).padStart(2, '0')}-${String(actualDay).padStart(2, '0')}`;
        const isOverdue = new Date(dueDate) < new Date();

        // Filtro de cliente
        const clientMatch = isAllClients || (template.client_id && selectedClientIds.includes(template.client_id));
        if (!clientMatch) return;

        combined.push({
          id: `virtual-rec-${template.id}-${m}`,
          description: template.description,
          type: template.type as any,
          amount: template.amount,
          category: template.category,
          due_date: dueDate,
          status: isOverdue ? 'overdue' : 'pending',
          client_id: template.client_id,
          is_virtual: true,
          recurrence: 'none',
          template_id: template.id
        });
      });
    });

    // Sort by date
    combined.sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());

    const expenses = combined.filter(t => t.type === 'expense');
    const incomes = combined.filter(t => t.type === 'income');

    const totalExpenses = expenses.reduce((acc, t) => acc + Number(t.amount), 0);
    const totalIncomes = incomes.reduce((acc, t) => acc + Number(t.amount), 0);

    return {
      expenses,
      incomes,
      totalExpenses,
      totalIncomes,
      saldo: totalIncomes - totalExpenses
    };
  }, [transactions, clients, selectedMonths, selectedClientIds, year]);

  // Actions
  const handleToggleStatus = async (item: Transaction) => {
    try {
      if (item.is_virtual) {
        // Convert Virtual to Real (Create)
        const { error } = await supabase.from('transactions').insert({
          company_id: selectedCompany?.id,
          client_id: item.client_id,
          description: item.description,
          type: item.type,
          amount: item.amount,
          category: item.category,
          due_date: item.due_date,
          status: 'paid',
          payment_date: new Date().toISOString(),
          recurrence: 'none',
          template_id: item.template_id?.startsWith('virtual') ? null : item.template_id // Se veio de um template recorrente
        });
        if (error) throw error;
      } else {
        // Toggle Real Status
        const newStatus = item.status === 'paid' ? 'pending' : 'paid';
        const updateData: any = { status: newStatus };

        if (newStatus === 'paid') {
          updateData.payment_date = new Date().toISOString();
        } else {
          updateData.payment_date = null;
        }

        const { error } = await supabase
          .from('transactions')
          .update(updateData)
          .eq('id', item.id);

        if (error) throw error;
      }
      fetchData();
    } catch (error) {
      console.error('Error toggling status:', error);
      toast.error('Erro ao atualizar status.', 'Erro');
    }
  };

  const handleEdit = (item: Transaction) => {
    setNewTransaction({
      description: item.description,
      amount: item.amount,
      type: item.type,
      category: item.category,
      due_date: item.due_date,
      status: item.status,
      recurrence: (item.recurrence === 'monthly' || (item.recurrence as string) === 'Mensal' || (item.recurrence as string) === 'mensal') ? 'monthly' : 'none',
      recurrence_until: item.recurrence_until,
      client_id: item.client_id,
      template_id: item.template_id || null
    });
    setEditingId(item.id);
    setIsModalOpen(true);
  };

  const handleSaveTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompany) return;

    try {
      if (editingId) {
        // Edit existing transaction
        const { error } = await supabase
          .from('transactions')
          .update({
            description: newTransaction.description,
            amount: Number(newTransaction.amount),
            type: newTransaction.type,
            category: newTransaction.category,
            due_date: newTransaction.due_date,
            status: newTransaction.status,
            recurrence: newTransaction.recurrence,
            recurrence_until: newTransaction.recurrence_until || null,
            client_id: newTransaction.client_id || null,
            ...(newTransaction.status === 'paid' ? { payment_date: new Date().toISOString() } : { payment_date: null })
          })
          .eq('id', editingId);

        if (error) throw error;
      } else {
        // Create new transaction
        const { error } = await supabase.from('transactions').insert({
          company_id: selectedCompany.id,
          description: newTransaction.description,
          amount: Number(newTransaction.amount),
          type: newTransaction.type,
          category: newTransaction.category,
          due_date: newTransaction.due_date,
          status: newTransaction.status,
          recurrence: newTransaction.recurrence || 'none',
          recurrence_until: newTransaction.recurrence_until || null,
          client_id: newTransaction.client_id || null,
          ...(newTransaction.status === 'paid' ? { payment_date: new Date().toISOString() } : {})
        });

        if (error) throw error;
      }

      setIsModalOpen(false);
      setEditingId(null);
      setNewTransaction({
        type: 'expense',
        status: 'pending',
        category: 'Outros',
        due_date: new Date().toISOString().split('T')[0],
        recurrence: 'none',
        recurrence_until: null,
        client_id: undefined,
        template_id: null
      });
      fetchData();
    } catch (error) {
      console.error('Error saving transaction:', error);
      toast.error('Erro ao salvar lançamento.', 'Erro');
    }
  };

  const handleDelete = async (id: string) => {
    if (!await confirm('Excluir Lançamento', 'Tem certeza que deseja excluir este lançamento?', { type: 'danger' })) return;

    try {
      const { error } = await supabase.from('transactions').delete().eq('id', id);
      if (error) throw error;
      fetchData();
    } catch (error) {
      console.error('Error deleting:', error);
    }
  };

  if (!selectedCompany) return <div className="text-white p-8">Selecione uma empresa.</div>;

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto">
      {/* Header & Filtros */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex-1"></div>

        <div className="flex flex-wrap items-center gap-2 bg-white/5 p-2 rounded-xl border border-white/10">
          <Select
            multiple
            value={selectedClientIds}
            onChange={(v) => setSelectedClientIds(v)}
            options={[
              { value: 'all', label: 'Todos os Clientes' },
              ...clients.map(c => ({ value: c.id, label: c.name }))
            ]}
          />
          <div className="w-px h-5 bg-white/10 hidden sm:block" />
          <Select
            multiple
            value={selectedMonths}
            onChange={(v) => setSelectedMonths(v)}
            options={[
              { value: 'all', label: 'Todos os Meses' },
              ...Array.from({ length: 12 }, (_, i) => ({
                value: i + 1,
                label: new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(new Date(2000, i))
              }))
            ]}
            icon={<Calendar size={14} />}
          />
          <Select
            value={year}
            onChange={(v) => setYear(Number(v))}
            options={Array.from({ length: 5 }, (_, i) => ({
              value: new Date().getFullYear() - 2 + i,
              label: String(new Date().getFullYear() - 2 + i)
            }))}
          />
        </div>
      </div>

      {/* Card de Saldo Central */}
      <div className={`glass-card p-8 rounded-3xl border border-white/10 flex flex-col md:flex-row items-center justify-between gap-8 transition-colors duration-500 ${displayData.saldo >= 0 ? 'bg-green-500/5 hover:bg-green-500/10' : 'bg-red-500/5 hover:bg-red-500/10'
        }`}>
        <div className="flex items-center space-x-6">
          <div className={`p-4 rounded-2xl shadow-lg ${displayData.saldo >= 0 ? 'bg-green-500/20 text-green-400 shadow-green-500/10' : 'bg-red-500/20 text-red-400 shadow-red-500/10'
            }`}>
            {displayData.saldo >= 0 ? <TrendingUp size={40} /> : <TrendingDown size={40} />}
          </div>
          <div>
            <p className="text-gray-400 text-sm font-medium uppercase tracking-widest">Saldo Líquido Mensal</p>
            <h2 className={`text-5xl font-black mt-1 ${displayData.saldo >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(displayData.saldo)}
            </h2>
          </div>
        </div>

        {/* Resumo Lateral */}
        <div className="flex space-x-8 border-l border-white/10 pl-8">
          <div className="text-right group">
            <p className="text-gray-500 text-xs uppercase mb-1 group-hover:text-green-400 transition-colors">Receitas</p>
            <p className="text-green-400 font-bold text-xl">
              +{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(displayData.totalIncomes)}
            </p>
          </div>
          <div className="text-right group">
            <p className="text-gray-500 text-xs uppercase mb-1 group-hover:text-red-400 transition-colors">Custos</p>
            <p className="text-red-400 font-bold text-xl">
              -{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(displayData.totalExpenses)}
            </p>
          </div>
        </div>
      </div>

      {/* Grid de Duas Colunas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* Coluna de Custos (Esquerda) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-2 pb-2 border-b border-white/5">
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <div className="p-1.5 bg-red-500/20 rounded-lg">
                <TrendingDown className="text-red-400" size={18} />
              </div>
              Custos
            </h3>
            <span className="text-red-400 font-bold bg-red-400/10 px-3 py-1 rounded-full text-sm border border-red-500/20">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(displayData.totalExpenses)}
            </span>
          </div>

          <div className="space-y-3">
            {displayData.expenses.map(item => (
              <TransactionCard
                key={item.id}
                item={item}
                onToggle={() => handleToggleStatus(item)}
                onEdit={() => handleEdit(item)}
                onDelete={() => handleDelete(item.id)}
              />
            ))}
            {displayData.expenses.length === 0 && <EmptyState text="Nenhum custo registrado este mês." />}
          </div>
        </div>

        {/* Coluna de Receitas (Direita) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-2 pb-2 border-b border-white/5">
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <div className="p-1.5 bg-green-500/20 rounded-lg">
                <TrendingUp className="text-green-400" size={18} />
              </div>
              Receitas
            </h3>
            <span className="text-green-400 font-bold bg-green-400/10 px-3 py-1 rounded-full text-sm border border-green-500/20">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(displayData.totalIncomes)}
            </span>
          </div>

          <div className="space-y-3">
            {displayData.incomes.map(item => (
              <TransactionCard
                key={item.id}
                item={item}
                onToggle={() => handleToggleStatus(item)}
                onEdit={() => handleEdit(item)}
                onDelete={() => handleDelete(item.id)}
              />
            ))}
            {displayData.incomes.length === 0 && <EmptyState text="Nenhuma receita prevista este mês." />}
          </div>
        </div>
      </div>

      {/* Modal Novo Lançamento */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* 1. Overlay Premium */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-md z-0 animate-in fade-in duration-300"
            onClick={() => { setIsModalOpen(false); setEditingId(null); setNewTransaction({ type: 'expense', status: 'pending', category: 'Outros', due_date: new Date().toISOString().split('T')[0], recurrence: 'none', recurrence_until: null, client_id: undefined, template_id: null }); }}
          >
            <div className="absolute inset-0 opacity-[0.03] bg-[url('https://grainy-gradients.vercel.app/noise.svg')]"></div>
          </div>

          {/* 2. Container Glass Premium */}
          <div className="relative z-10 w-full max-w-lg rounded-[22px] overflow-hidden shadow-[0_32px_64px_-12px_rgba(0,0,0,0.6)] animate-in zoom-in-95 duration-300 border border-white/10 bg-[#0a0a1a]/10 backdrop-blur-xl ring-1 ring-white/10 ring-inset">

            {/* Grain Texture Overlay */}
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')] z-0"></div>

            {/* Glow Effects */}
            <div className="absolute inset-0 rounded-[22px] border border-white/5 pointer-events-none"></div>
            <div className="absolute top-[-50px] left-1/2 -translate-x-1/2 w-[80%] h-[100px] bg-primary/40 blur-[80px] pointer-events-none rounded-[100%]"></div>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/3 h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent shadow-[0_0_20px_2px_rgba(99,102,241,0.6)]"></div>

            <div className="flex justify-between items-start p-8 pb-4 relative z-20">
              <div>
                <h2 className="text-xl font-medium text-[#EEEEEE]">{editingId ? 'Editar Lançamento' : 'Novo lançamento'}</h2>
                <p className="text-[#6e6e6e] text-xs mt-1 font-light">Registre suas movimentações financeiras.</p>
              </div>
              <button
                onClick={() => { setIsModalOpen(false); setEditingId(null); setNewTransaction({ type: 'expense', status: 'pending', category: 'Outros', due_date: new Date().toISOString().split('T')[0], recurrence: 'none', recurrence_until: null, client_id: undefined, template_id: null }); }}
                className="p-1.5 text-gray-500 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveTransaction} className="p-8 pt-2 space-y-5 relative z-20">
              {/* Tipo */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setNewTransaction({ ...newTransaction, type: 'income' })}
                  className={`p-3 rounded-xl border flex items-center justify-center gap-2 transition-all text-sm font-medium ${newTransaction.type === 'income'
                    ? 'bg-green-500/10 border-green-500/30 text-green-400 shadow-[0_0_15px_-5px_rgba(34,197,94,0.3)]'
                    : 'bg-white/[0.03] border-white/[0.08] text-gray-400 hover:bg-white/[0.06] hover:text-white'
                    }`}
                >
                  <TrendingUp size={18} /> Receita
                </button>
                <button
                  type="button"
                  onClick={() => setNewTransaction({ ...newTransaction, type: 'expense' })}
                  className={`p-3 rounded-xl border flex items-center justify-center gap-2 transition-all text-sm font-medium ${newTransaction.type === 'expense'
                    ? 'bg-red-500/10 border-red-500/30 text-red-400 shadow-[0_0_15px_-5px_rgba(239,68,68,0.3)]'
                    : 'bg-white/[0.03] border-white/[0.08] text-gray-400 hover:bg-white/[0.06] hover:text-white'
                    }`}
                >
                  <TrendingDown size={18} /> Despesa
                </button>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-medium text-gray-500 tracking-wide ml-1">Descrição</label>
                <input
                  required
                  className="w-full bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] rounded-xl px-4 py-3 text-white/90 focus:bg-white/[0.08] focus:border-primary/30 focus:ring-0 outline-none transition-all duration-300 text-sm font-light placeholder-[#6e6e6e]"
                  placeholder="Ex: Aluguel, Projeto X..."
                  value={newTransaction.description || ''}
                  onChange={e => setNewTransaction({ ...newTransaction, description: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-medium text-gray-500 tracking-wide ml-1">Valor (R$)</label>
                  <div className="relative group">
                    <div className="absolute left-4 top-3.5 text-[#6e6e6e] text-sm font-light pointer-events-none">R$</div>
                    <IMaskInput
                      mask={Number}
                      scale={2}
                      thousandsSeparator="."
                      padFractionalZeros={true}
                      normalizeZeros={false}
                      radix=","
                      mapToRadix={['.']}
                      unmask={true}
                      lazy={true}
                      className="w-full bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] rounded-xl pl-10 pr-4 py-3 text-white/90 focus:bg-white/[0.08] focus:border-primary/30 focus:ring-0 outline-none transition-all duration-300 text-sm font-light"
                      placeholder="0,00"
                      value={newTransaction.amount ? String(newTransaction.amount) : ''}
                      onAccept={(_value, mask) => {
                        const numericValue = Number(mask.unmaskedValue);
                        if (newTransaction.amount !== numericValue) {
                          setNewTransaction({ ...newTransaction, amount: numericValue });
                        }
                      }}
                      onFocus={(e: React.FocusEvent<HTMLInputElement>) => {
                        if (e.target.value === '0,00') e.target.value = '';
                      }}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-medium text-gray-500 tracking-wide ml-1">Data de vencimento</label>
                  <input
                    required
                    type="date"
                    className="w-full bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] rounded-xl px-4 py-3 text-white/90 focus:bg-white/[0.08] focus:border-primary/30 focus:ring-0 outline-none transition-all duration-300 text-sm font-light"
                    value={newTransaction.due_date || ''}
                    onChange={e => setNewTransaction({ ...newTransaction, due_date: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-medium text-gray-500 tracking-wide ml-1">Categoria</label>
                  <div className="relative group">
                    <Select
                      value={newTransaction.category || 'Outros'}
                      onChange={v => setNewTransaction({ ...newTransaction, category: String(v) })}
                      options={[
                        { value: 'Operacional', label: 'Operacional' },
                        { value: 'Marketing', label: 'Marketing' },
                        { value: 'Ferramentas', label: 'Ferramentas' },
                        { value: 'Impostos', label: 'Impostos' },
                        { value: 'Pessoal', label: 'Pessoal' },
                        { value: 'Outros', label: 'Outros' },
                      ]}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-medium text-gray-500 tracking-wide ml-1">Vincular cliente</label>
                  <div className="relative group">
                    <Select
                      value={newTransaction.client_id || ''}
                      onChange={v => setNewTransaction({ ...newTransaction, client_id: v === '' ? undefined : String(v) })}
                      options={[
                        { value: '', label: 'Sem vínculo' },
                        ...clients.map(c => ({ value: c.id, label: c.name }))
                      ]}
                    />
                  </div>
                </div>
              </div>

              {/* Recorrência */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-medium text-gray-500 tracking-wide ml-1">Recorrência</label>
                  <div className="relative group">
                    <Select
                      className={newTransaction.template_id ? "opacity-50 !cursor-not-allowed pointer-events-none" : ""}
                      value={newTransaction.template_id ? 'instance' : (newTransaction.recurrence || 'none')}
                      onChange={v => {
                          if (!newTransaction.template_id) {
                              setNewTransaction({ ...newTransaction, recurrence: String(v) as any })
                          }
                      }}
                      options={[
                        { value: 'none', label: 'Nenhuma' },
                        { value: 'monthly', label: 'Mensal' },
                        ...(newTransaction.template_id ? [{ value: 'instance', label: 'Mensal (Instância)' }] : [])
                      ]}
                    />
                  </div>
                </div>
                {newTransaction.recurrence === 'monthly' && !newTransaction.template_id && (
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-medium text-gray-500 tracking-wide ml-1">Encerrar em (opcional)</label>
                    <input
                      type="date"
                      className="w-full bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] rounded-xl px-4 py-3 text-white/90 focus:bg-white/[0.08] focus:border-primary/30 focus:ring-0 outline-none transition-all duration-300 text-sm font-light"
                      value={newTransaction.recurrence_until || ''}
                      onChange={e => setNewTransaction({ ...newTransaction, recurrence_until: e.target.value })}
                    />
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-medium text-gray-500 tracking-wide ml-1">Status inicial</label>
                <div className="flex gap-3 bg-white/[0.02] p-1.5 rounded-xl border border-white/[0.05]">
                  <button
                    type="button"
                    onClick={() => setNewTransaction({ ...newTransaction, status: 'pending' })}
                    className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${newTransaction.status === 'pending' ? 'bg-white/10 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
                  >
                    Pendente
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewTransaction({ ...newTransaction, status: 'paid' })}
                    className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${newTransaction.status === 'paid' ? 'bg-green-500/20 text-green-400 shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
                  >
                    Pago
                  </button>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => { setIsModalOpen(false); setEditingId(null); setNewTransaction({ type: 'expense', status: 'pending', category: 'Outros', due_date: new Date().toISOString().split('T')[0], recurrence: 'none', recurrence_until: null, client_id: undefined, template_id: null }); }}
                  className="px-6 py-2.5 text-sm text-gray-500 hover:text-red-500 transition-colors font-medium flex items-center justify-center"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-8 py-2.5 bg-primary hover:bg-secondary text-white rounded-xl shadow-lg shadow-primary/20 transition-all duration-300 font-medium text-sm flex items-center justify-center"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// Componente de Card Individual
const TransactionCard = ({ item, onToggle, onEdit, onDelete }: { item: Transaction, onToggle: () => void, onEdit: () => void, onDelete: () => void }) => {
  const isPaid = item.status === 'paid';
  const isOverdue = item.status === 'overdue';
  const isVirtual = item.is_virtual;

  return (
    <div className={`glass-card p-4 rounded-2xl border border-white/5 flex items-center justify-between group hover:border-white/20 transition-all relative overflow-hidden`}>
      {/* Indicador Lateral Colorido */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${item.type === 'income' ? 'bg-green-500' : 'bg-red-500'}`} />

      <div className="flex items-center space-x-4 pl-2">
        {/* Botão de Status */}
        <button
          onClick={onToggle}
          title={isPaid ? "Marcar como pendente" : "Marcar como pago"}
          className={`p-2.5 rounded-xl transition-all duration-300 transform active:scale-95 ${isPaid
            ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
            : isOverdue
              ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30 animate-pulse'
              : 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30'
            }`}>
          {isPaid ? <CheckCircle size={20} /> : isOverdue ? <AlertCircle size={20} /> : <Clock size={20} />}
        </button>

        {/* Informações */}
        <div>
          <div className="flex items-center gap-2">
            <p className={`font-medium ${isPaid ? 'text-gray-300 line-through decoration-gray-600' : 'text-white'}`}>
              {item.description}
            </p>
            {isVirtual && (
              <span className="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full tracking-tight font-medium border border-blue-500/20">
                Automático
              </span>
            )}
          </div>
          <div className="flex items-center space-x-3 text-xs text-gray-500 mt-1">
            <span className="bg-white/5 px-2 py-0.5 rounded text-gray-400">{item.category}</span>
            <span>•</span>
            <span className={`${isOverdue && !isPaid ? 'text-red-400 font-bold' : ''}`}>
              {new Date(item.due_date).toLocaleDateString('pt-BR')}
            </span>
          </div>
        </div>
      </div>

      {/* Valor e Ações */}
      <div className="flex items-center space-x-4">
        <p className={`font-bold text-lg ${item.type === 'income' ? 'text-green-400' : 'text-red-400'}`}>
          {item.type === 'income' ? '+' : '-'}{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.amount)}
        </p>

        {/* Menu de Ações (Apenas para não virtuais por enquanto) */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {!isVirtual && (
            <>
              <button
                onClick={onEdit}
                className="text-gray-600 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/5"
                title="Editar"
              >
                <Edit2 size={18} />
              </button>
              <button
                onClick={onDelete}
                className="text-gray-600 hover:text-red-400 transition-colors p-2 rounded-lg hover:bg-white/5"
                title="Excluir"
              >
                <Trash2 size={18} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const EmptyState = ({ text }: { text: string }) => (
  <div className="text-center py-12 bg-white/5 rounded-3xl border border-dashed border-white/10 flex flex-col items-center justify-center group hover:bg-white/[0.07] transition-colors">
    <div className="p-4 bg-white/5 rounded-full mb-3 group-hover:scale-110 transition-transform">
      <Search className="text-gray-500" size={24} />
    </div>
    <p className="text-gray-500 italic text-sm">{text}</p>
  </div>
);

export default FinanceiroLancamentos;
