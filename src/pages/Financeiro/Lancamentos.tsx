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
}

interface Client {
  id: string;
  name: string;
  mrr: number;
  due_day: number;
  status: 'active' | 'paused' | 'canceled';
}

const FinanceiroLancamentos = () => {
  const { selectedCompany } = useCompany();
  const [month, setMonth] = useState(new Date().getMonth() + 1);
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
    due_date: new Date().toISOString().split('T')[0]
  });

  // Fetch Data
  const fetchData = async () => {
    if (!selectedCompany) return;
    setLoading(true);
    try {
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const endDate = new Date(year, month, 0).toISOString().split('T')[0];

      const [transRes, clientsRes] = await Promise.all([
        supabase
          .from('transactions')
          .select('*')
          .eq('company_id', selectedCompany.id)
          .gte('due_date', startDate)
          .lte('due_date', endDate),
        supabase
          .from('clients')
          .select('id, name, mrr, due_day, status')
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

  useEffect(() => { fetchData(); }, [selectedCompany, month, year]);

  // Logic: Merge Real Transactions + Virtual MRR
  const displayData = useMemo(() => {
    const combined = [...transactions];
    
    // Identify clients who already have an income transaction this month
    const clientsWithPayments = new Set(
      transactions
        .filter(t => t.type === 'income' && t.client_id)
        .map(t => t.client_id)
    );

    // Generate virtual transactions for active clients without payment
    clients.forEach((client) => {
      if (!clientsWithPayments.has(client.id)) {
        // Calculate due date based on client's due_day setting
        // Handle edge case where due_day > days in month (e.g. Feb 30)
        const daysInMonth = new Date(year, month, 0).getDate();
        const actualDay = Math.min(client.due_day, daysInMonth);
        const dueDate = `${year}-${String(month).padStart(2, '0')}-${String(actualDay).padStart(2, '0')}`;
        
        const isOverdue = new Date(dueDate) < new Date() && new Date().getDate() > actualDay;

        combined.push({
          id: `virtual-${client.id}`,
          description: `Mensalidade: ${client.name}`,
          type: 'income',
          amount: client.mrr,
          category: 'Contrato MRR',
          due_date: dueDate,
          status: isOverdue ? 'overdue' : 'pending',
          client_id: client.id,
          is_virtual: true
        });
      }
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
  }, [transactions, clients, month, year]);

  // Actions
  const handleToggleStatus = async (item: Transaction) => {
    try {
      if (item.is_virtual) {
        // Convert Virtual to Real (Create)
        const { error } = await supabase.from('transactions').insert({
          company_id: selectedCompany?.id,
          client_id: item.client_id,
          description: item.description,
          type: 'income',
          amount: item.amount,
          category: item.category,
          due_date: item.due_date,
          status: 'paid',
          payment_date: new Date().toISOString(),
          recurrence: 'monthly'
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
      alert('Erro ao atualizar status.');
    }
  };

  const handleEdit = (item: Transaction) => {
    setNewTransaction({
      description: item.description,
      amount: item.amount,
      type: item.type,
      category: item.category,
      due_date: item.due_date,
      status: item.status
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
          recurrence: 'none', // Default for manual entry
          ...(newTransaction.status === 'paid' ? { payment_date: new Date().toISOString() } : {})
        });

        if (error) throw error;
      }
      
      setIsModalOpen(false);
      setEditingId(null);
      setNewTransaction({
        type: 'expense',
        status: 'pending',
        due_date: new Date().toISOString().split('T')[0]
      });
      fetchData();
    } catch (error) {
      console.error('Error saving transaction:', error);
      alert('Erro ao salvar lançamento.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este lançamento?')) return;
    
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
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400">
            Fluxo de Caixa
          </h1>
          <p className="text-gray-400 mt-1">Gerencie suas entradas e saídas.</p>
        </div>
        
        <div className="flex items-center space-x-4">
            <div className="flex items-center bg-white/5 p-1 rounded-xl border border-white/10">
                <Calendar size={18} className="text-primary ml-3 mr-1" />
                <select 
                  value={month} 
                  onChange={e => setMonth(Number(e.target.value))} 
                  className="bg-transparent text-white p-2 outline-none cursor-pointer"
                >
                    {Array.from({length: 12}, (_, i) => (
                      <option key={i+1} value={i+1} className="bg-[#0a0a1a]">
                        {new Intl.DateTimeFormat('pt-BR', {month:'long'}).format(new Date(2000, i))}
                      </option>
                    ))}
                </select>
                <div className="w-px h-4 bg-white/10 mx-1"></div>
                <select 
                  value={year} 
                  onChange={e => setYear(Number(e.target.value))} 
                  className="bg-transparent text-white p-2 outline-none cursor-pointer"
                >
                    {[2024, 2025, 2026].map(y => (
                      <option key={y} value={y} className="bg-[#0a0a1a]">{y}</option>
                    ))}
                </select>
            </div>
            
            <button 
              onClick={() => setIsModalOpen(true)} 
              className="bg-primary hover:bg-secondary text-white px-6 py-3 rounded-xl flex items-center space-x-2 transition-all shadow-lg shadow-primary/20 hover:scale-105"
            >
                <Plus size={20} />
                <span>Novo Lançamento</span>
            </button>
        </div>
      </div>

      {/* Card de Saldo Central */}
      <div className={`glass-card p-8 rounded-3xl border border-white/10 flex flex-col md:flex-row items-center justify-between gap-8 transition-colors duration-500 ${
        displayData.saldo >= 0 ? 'bg-green-500/5 hover:bg-green-500/10' : 'bg-red-500/5 hover:bg-red-500/10'
      }`}>
        <div className="flex items-center space-x-6">
            <div className={`p-4 rounded-2xl shadow-lg ${
              displayData.saldo >= 0 ? 'bg-green-500/20 text-green-400 shadow-green-500/10' : 'bg-red-500/20 text-red-400 shadow-red-500/10'
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-lg p-6 rounded-2xl border border-white/10 relative bg-[#0a0a1a]">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-white">{editingId ? 'Editar Lançamento' : 'Novo Lançamento'}</h2>
              <button onClick={() => { setIsModalOpen(false); setEditingId(null); setNewTransaction({type: 'expense', status: 'pending', due_date: new Date().toISOString().split('T')[0]}); }} className="text-gray-400 hover:text-white"><X size={24} /></button>
            </div>
            
            <form onSubmit={handleSaveTransaction} className="space-y-4">
              {/* Tipo */}
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setNewTransaction({...newTransaction, type: 'income'})}
                  className={`p-3 rounded-xl border flex items-center justify-center gap-2 transition-all ${
                    newTransaction.type === 'income' 
                    ? 'bg-green-500/20 border-green-500 text-green-400' 
                    : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                  }`}
                >
                  <TrendingUp size={20} /> Receita
                </button>
                <button
                  type="button"
                  onClick={() => setNewTransaction({...newTransaction, type: 'expense'})}
                  className={`p-3 rounded-xl border flex items-center justify-center gap-2 transition-all ${
                    newTransaction.type === 'expense' 
                    ? 'bg-red-500/20 border-red-500 text-red-400' 
                    : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                  }`}
                >
                  <TrendingDown size={20} /> Despesa
                </button>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Descrição</label>
                <input 
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white focus:border-primary focus:outline-none"
                  placeholder="Ex: Aluguel, Projeto X..."
                  value={newTransaction.description || ''}
                  onChange={e => setNewTransaction({...newTransaction, description: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Valor (R$)</label>
                  <input 
                    required
                    type="number"
                    step="0.01"
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white focus:border-primary focus:outline-none"
                    placeholder="0,00"
                    value={newTransaction.amount || ''}
                    onChange={e => setNewTransaction({...newTransaction, amount: Number(e.target.value)})}
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Data de Vencimento</label>
                  <input 
                    required
                    type="date"
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white focus:border-primary focus:outline-none"
                    value={newTransaction.due_date || ''}
                    onChange={e => setNewTransaction({...newTransaction, due_date: e.target.value})}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Categoria</label>
                <select 
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white focus:border-primary focus:outline-none"
                  value={newTransaction.category || ''}
                  onChange={e => setNewTransaction({...newTransaction, category: e.target.value})}
                >
                  <option value="" disabled>Selecione...</option>
                  <option value="Operacional" className="bg-[#0a0a1a]">Operacional</option>
                  <option value="Marketing" className="bg-[#0a0a1a]">Marketing</option>
                  <option value="Ferramentas" className="bg-[#0a0a1a]">Ferramentas</option>
                  <option value="Impostos" className="bg-[#0a0a1a]">Impostos</option>
                  <option value="Pessoal" className="bg-[#0a0a1a]">Pessoal</option>
                  <option value="Outros" className="bg-[#0a0a1a]">Outros</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Status Inicial</label>
                <div className="flex gap-4">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input 
                      type="radio" 
                      name="status" 
                      checked={newTransaction.status === 'pending'}
                      onChange={() => setNewTransaction({...newTransaction, status: 'pending'})}
                      className="text-primary focus:ring-primary"
                    />
                    <span className="text-white">Pendente</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input 
                      type="radio" 
                      name="status" 
                      checked={newTransaction.status === 'paid'}
                      onChange={() => setNewTransaction({...newTransaction, status: 'paid'})}
                      className="text-primary focus:ring-primary"
                    />
                    <span className="text-white">Pago</span>
                  </label>
                </div>
              </div>

              <button 
                type="submit" 
                className="w-full bg-primary hover:bg-secondary text-white py-3 rounded-xl font-bold transition-all mt-4 shadow-lg shadow-primary/20"
              >
                Salvar Lançamento
              </button>
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
              className={`p-2.5 rounded-xl transition-all duration-300 transform active:scale-95 ${
                isPaid 
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
                    <span className="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full uppercase tracking-wider font-bold border border-blue-500/20">
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
