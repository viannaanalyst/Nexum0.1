import React, { useState, useMemo, useEffect } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  AlertCircle, 
  PieChart as PieIcon,
  ArrowUpRight,
  Calendar,
  Filter,
  ArrowDownRight
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
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
  payment_date?: string;
  status: 'paid' | 'pending' | 'overdue';
  client_id?: string;
}

interface Client {
  id: string;
  name: string;
  status: 'active' | 'paused' | 'canceled';
  mrr: number;
  due_day: number;
}

const FinanceiroVisaoGeral = () => {
  const { selectedCompany } = useCompany();
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [selectedClientId, setSelectedClientId] = useState<string>('all');
  
  // Data States
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [clients, setClients] = useState<Client[]>([]);

  // Fetch Data
  useEffect(() => {
    if (selectedCompany) {
      fetchData();
    }
  }, [selectedCompany, month, year]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (!selectedCompany) return;

      // Fetch Transactions for the selected month/year
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const endDate = new Date(year, month, 0).toISOString().split('T')[0]; // Last day of month

      const { data: transactionsData, error: transactionsError } = await supabase
        .from('transactions')
        .select('*')
        .eq('company_id', selectedCompany.id)
        .gte('due_date', startDate)
        .lte('due_date', endDate);

      if (transactionsError) throw transactionsError;

      // Fetch Clients for MRR calculation
      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select('id, name, status, mrr, due_day')
        .eq('company_id', selectedCompany.id);

      if (clientsError) throw clientsError;

      setTransactions(transactionsData || []);
      setClients(clientsData || []);
    } catch (error) {
      console.error('Error fetching financial data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter Data
  const filteredData = useMemo(() => {
    const filteredTransactions = selectedClientId === 'all'
      ? transactions
      : transactions.filter(t => t.client_id === selectedClientId);

    const filteredClients = selectedClientId === 'all'
      ? clients
      : clients.filter(c => c.id === selectedClientId);

    return { filteredTransactions, filteredClients };
  }, [selectedClientId, transactions, clients]);

  const { filteredTransactions, filteredClients } = filteredData;

  // Logic Calculation
  const stats = useMemo(() => {
    // 1. Calculate MRR from active clients
    // Logic: If a client has a manual transaction for this month, don't count MRR to avoid duplication
    const clientTransactionIds = new Set(
      filteredTransactions
        .filter(t => t.client_id && t.type === 'income')
        .map(t => t.client_id)
    );

    const mrrTotal = filteredClients
      .filter(c => c.status === 'active' && !clientTransactionIds.has(c.id))
      .reduce((acc, c) => acc + (Number(c.mrr) || 0), 0);

    // 2. Calculate Manual Income (Paid)
    const manualIncome = filteredTransactions
      .filter(t => t.type === 'income' && t.status === 'paid')
      .reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
    
    // 3. Calculate Expenses (All recorded expenses for the period)
    const expenses = filteredTransactions
      .filter(t => t.type === 'expense') // We might want to filter by 'paid' status for cash flow, or all for accrual
      .reduce((acc, t) => acc + (Number(t.amount) || 0), 0);

    const faturamentoBruto = mrrTotal + manualIncome;
    const lucroLiquido = faturamentoBruto - expenses;
    const margem = faturamentoBruto > 0 ? (lucroLiquido / faturamentoBruto) * 100 : 0;

    // 4. Overdue Payments
    const overdueAmount = filteredTransactions
      .filter(t => t.status === 'overdue')
      .reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
    
    const overdueCount = filteredTransactions.filter(t => t.status === 'overdue').length;

    // 5. Projeção Próximo Mês (Soma de todos os MRRs ativos sem descontar lançamentos)
    const projecaoProximoMes = filteredClients
      .filter(c => c.status === 'active')
      .reduce((acc, c) => acc + (Number(c.mrr) || 0), 0);

    return { 
      mrrTotal, 
      faturamentoBruto, 
      expenses, 
      lucroLiquido, 
      margem,
      overdueAmount,
      overdueCount,
      projecaoProximoMes
    };
  }, [filteredTransactions, filteredClients]);

  // Chart Data Preparation
  const cashFlowData = useMemo(() => {
    // This is a placeholder for monthly comparison. 
    // In a real scenario, we would need to fetch data for the whole year.
    // For now, let's show the current month as a bar.
    return [
      { name: 'Jan', receita: 0, despesa: 0 },
      { name: 'Fev', receita: 0, despesa: 0 },
      { name: 'Mar', receita: 0, despesa: 0 },
      { name: 'Abr', receita: 0, despesa: 0 },
      { name: 'Mai', receita: 0, despesa: 0 },
      { name: 'Jun', receita: 0, despesa: 0 },
      { name: 'Jul', receita: 0, despesa: 0 },
      { name: 'Ago', receita: 0, despesa: 0 },
      { name: 'Set', receita: 0, despesa: 0 },
      { name: 'Out', receita: 0, despesa: 0 },
      { name: 'Nov', receita: 0, despesa: 0 },
      { name: 'Dez', receita: 0, despesa: 0 },
    ].map((item, index) => {
      if (index + 1 === month) {
        return { 
          name: item.name, 
          receita: stats.faturamentoBruto, 
          despesa: stats.expenses 
        };
      }
      return item;
    });
  }, [stats, month]);

  const categoryData = useMemo(() => {
    const categories: Record<string, number> = {};
    
    filteredTransactions
      .filter(t => t.type === 'expense')
      .forEach(t => {
        categories[t.category] = (categories[t.category] || 0) + Number(t.amount);
      });

    return Object.entries(categories).map(([name, value]) => ({ name, value }));
  }, [filteredTransactions]);

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

  if (!selectedCompany) return <div className="text-white p-8">Selecione uma empresa.</div>;

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto">
      {/* Header com Filtros */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400">
            Visão Geral Financeira
          </h1>
          <p className="text-gray-400 mt-2">Acompanhe a saúde do seu caixa em tempo real.</p>
        </div>
        
        <div className="flex items-center space-x-4 bg-white/5 p-2 rounded-xl border border-white/10">
          <Filter size={20} className="text-primary ml-2" />
          <select 
            value={selectedClientId} 
            onChange={(e) => setSelectedClientId(e.target.value)}
            className="bg-transparent text-white border-none focus:ring-0 cursor-pointer outline-none max-w-[150px] truncate"
          >
            <option value="all" className="bg-[#0a0a1a]">Todos os Clientes</option>
            {clients.map(client => (
              <option key={client.id} value={client.id} className="bg-[#0a0a1a]">
                {client.name}
              </option>
            ))}
          </select>

          <div className="w-px h-6 bg-white/10 mx-2"></div>

          <Calendar size={20} className="text-primary ml-2" />
          <select 
            value={month} 
            onChange={(e) => setMonth(Number(e.target.value))}
            className="bg-transparent text-white border-none focus:ring-0 cursor-pointer outline-none"
          >
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={i + 1} className="bg-[#0a0a1a]">
                {new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(new Date(2000, i))}
              </option>
            ))}
          </select>
          <select 
            value={year} 
            onChange={(e) => setYear(Number(e.target.value))}
            className="bg-transparent text-white border-none focus:ring-0 cursor-pointer outline-none"
          >
            {[2024, 2025, 2026].map(y => (
              <option key={y} value={y} className="bg-[#0a0a1a]">{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Banner de Inadimplência (Condicional) */}
      {stats.overdueCount > 0 && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-center justify-between animate-pulse">
          <div className="flex items-center space-x-3 text-red-400">
            <AlertCircle size={24} />
            <div>
              <p className="font-bold">Alerta de Inadimplência</p>
              <p className="text-sm opacity-80">Existem {stats.overdueCount} pagamentos atrasados este mês.</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wider opacity-60">Total Retido</p>
            <p className="text-xl font-bold text-red-400">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.overdueAmount)}
            </p>
          </div>
        </div>
      )}

      {/* Cards de KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
        <KpiCard 
          title="Faturamento Bruto" 
          value={stats.faturamentoBruto} 
          icon={<TrendingUp />} 
          color="text-green-400" 
          bg="bg-green-400/10"
        />
        <KpiCard 
          title="Receita MRR" 
          value={stats.mrrTotal} 
          icon={<DollarSign />} 
          color="text-primary" 
          bg="bg-primary/10"
        />
        <KpiCard 
          title="Custos Fixos" 
          value={stats.expenses} 
          icon={<TrendingDown />} 
          color="text-red-400" 
          bg="bg-red-400/10"
        />
        <KpiCard 
          title="Lucro Líquido" 
          value={stats.lucroLiquido} 
          icon={<ArrowUpRight />} 
          color="text-emerald-400" 
          bg="bg-emerald-400/10"
        />
        <KpiCard 
          title="Margem Real" 
          value={`${stats.margem.toFixed(1)}%`} 
          icon={<PieIcon />} 
          color="text-purple-400" 
          bg="bg-purple-400/10"
          isCurrency={false}
        />
        <KpiCard 
          title="Projeção (Próx. Mês)" 
          value={stats.projecaoProximoMes} 
          icon={<Calendar />} 
          color="text-blue-400" 
          bg="bg-blue-400/10"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Gráfico de Fluxo de Caixa */}
        <div className="lg:col-span-2 glass-card p-6 rounded-2xl border border-white/10 h-[400px] flex flex-col">
          <h2 className="text-xl font-bold text-white mb-6">Fluxo de Caixa (Receita vs Despesa)</h2>
          <div className="flex-1 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cashFlowData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis dataKey="name" stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px', color: '#fff' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Legend />
                <Bar dataKey="receita" name="Receita" fill="#4ade80" radius={[4, 4, 0, 0]} />
                <Bar dataKey="despesa" name="Despesa" fill="#f87171" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Custo por Categoria */}
        <div className="glass-card p-6 rounded-2xl border border-white/10 h-[400px] flex flex-col">
          <h2 className="text-xl font-bold text-white mb-6">Custos por Categoria</h2>
          {categoryData.length > 0 ? (
            <div className="flex-1 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px', color: '#fff' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              Nenhuma despesa registrada.
            </div>
          )}
        </div>
      </div>
      
      {/* Tabela Resumo (Opcional - Matriz Financeira) */}
      <div className="glass-card rounded-2xl border border-white/10 overflow-hidden">
        <div className="p-6 border-b border-white/10">
            <h2 className="text-xl font-bold text-white">Últimas Transações</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/5 text-gray-400 text-sm uppercase tracking-wider">
                <th className="px-6 py-4 font-medium">Descrição</th>
                <th className="px-6 py-4 font-medium">Categoria</th>
                <th className="px-6 py-4 font-medium">Data</th>
                <th className="px-6 py-4 font-medium">Valor</th>
                <th className="px-6 py-4 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10 text-gray-300">
              {filteredTransactions.length > 0 ? (
                filteredTransactions.slice(0, 5).map((t) => (
                  <tr key={t.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4 font-medium text-white flex items-center gap-2">
                        {t.type === 'income' ? <ArrowUpRight size={16} className="text-green-400" /> : <ArrowDownRight size={16} className="text-red-400" />}
                        {t.description}
                    </td>
                    <td className="px-6 py-4">{t.category}</td>
                    <td className="px-6 py-4">{new Date(t.due_date).toLocaleDateString('pt-BR')}</td>
                    <td className={`px-6 py-4 font-bold ${t.type === 'income' ? 'text-green-400' : 'text-red-400'}`}>
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(t.amount)}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        t.status === 'paid' ? 'bg-green-500/20 text-green-400' :
                        t.status === 'overdue' ? 'bg-red-500/20 text-red-400' :
                        'bg-yellow-500/20 text-yellow-400'
                      }`}>
                        {t.status === 'paid' ? 'Pago' : t.status === 'overdue' ? 'Atrasado' : 'Pendente'}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    Nenhuma transação encontrada para este período.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

interface KpiCardProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  color: string;
  bg?: string;
  isCurrency?: boolean;
}

const KpiCard = ({ title, value, icon, color, bg = 'bg-white/5', isCurrency = true }: KpiCardProps) => (
  <div className="glass-card p-6 rounded-2xl border border-white/10 hover:border-white/20 transition-all group">
    <div className={`p-3 rounded-xl w-fit mb-4 group-hover:scale-110 transition-transform ${bg} ${color}`}>
      {icon}
    </div>
    <p className="text-gray-400 text-sm font-medium">{title}</p>
    <p className="text-2xl font-bold text-white mt-1">
      {isCurrency && typeof value === 'number' 
        ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
        : value}
    </p>
  </div>
);

export default FinanceiroVisaoGeral;
