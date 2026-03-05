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
import { Select } from '../../components/ui/Select';
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
  start_date?: string;
  end_date?: string;
}

const FinanceiroVisaoGeral = () => {
  const { selectedCompany } = useCompany();
  const [loading, setLoading] = useState(true);

  // Now arrays to support multiple selection
  const [selectedMonths, setSelectedMonths] = useState<number[]>([new Date().getMonth() + 1]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>(['all']);

  // Data States
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [clients, setClients] = useState<Client[]>([]);

  // Fetch Data
  useEffect(() => {
    if (selectedCompany) {
      fetchData();
    }
  }, [selectedCompany, year]); // month and client filters apply over the yearly data in memory

  const fetchData = async () => {
    setLoading(true);
    try {
      if (!selectedCompany) return;

      // Fetch Transactions for the selected YEAR
      const startOfYear = `${year}-01-01`;
      const endOfYear = `${year}-12-31`;

      const { data: transactionsData, error: transactionsError } = await supabase
        .from('transactions')
        .select('*')
        .eq('company_id', selectedCompany.id)
        .gte('due_date', startOfYear)
        .lte('due_date', endOfYear);

      if (transactionsError) throw transactionsError;

      // Fetch Clients for MRR — active clients started before or during the year
      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select('id, name, status, mrr, due_day, start_date, end_date')
        .eq('company_id', selectedCompany.id)
        .lte('start_date', endOfYear);

      if (clientsError) throw clientsError;

      setTransactions(transactionsData || []);
      setClients(clientsData || []);
    } catch (error) {
      console.error('Error fetching financial data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter Data for the entire year (Global filters)
  const filteredData = useMemo(() => {
    const isAllClients = selectedClientIds.includes('all') || selectedClientIds.length === 0;

    const filteredTransactions = isAllClients
      ? transactions
      : transactions.filter(t => t.client_id && selectedClientIds.includes(t.client_id));

    const filteredClients = isAllClients
      ? clients
      : clients.filter(c => selectedClientIds.includes(c.id));

    return { filteredTransactions, filteredClients };
  }, [selectedClientIds, transactions, clients]);

  const { filteredTransactions, filteredClients } = filteredData;

  // KPIs Calculation for the *Selected Months*
  const stats = useMemo(() => {
    const isAllMonths = selectedMonths.includes('all' as any) || selectedMonths.length === 0;
    const effectiveMonths = isAllMonths ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] : selectedMonths;

    let totalFaturamentoBruto = 0;
    let totalExpenses = 0;
    let totalOverdueAmount = 0;
    let totalOverdueCount = 0;
    let latestMrrTotal = 0;

    effectiveMonths.forEach(m => {
      const monthStartDate = `${year}-${String(m).padStart(2, '0')}-01`;
      const monthEndDate = new Date(year, m, 0).toISOString().split('T')[0];

      const currentMonthTransactions = filteredTransactions.filter(t => {
        if (!t.due_date) return false;
        const tMonth = parseInt(t.due_date.split('-')[1], 10);
        const tYear = parseInt(t.due_date.split('-')[0], 10);
        return tMonth === m && tYear === year;
      });

      const clientTransactionIds = new Set(
        currentMonthTransactions
          .filter(t => t.client_id && t.type === 'income')
          .map(t => t.client_id)
      );

      const activeClientsThisMonth = filteredClients.filter(c => {
        if (c.status !== 'active') return false;
        if (!c.start_date) return false;
        const startedBeforeEnd = c.start_date <= monthEndDate;
        const endedAfterStart = !c.end_date || c.end_date === '' || c.end_date >= monthStartDate;
        return startedBeforeEnd && endedAfterStart;
      });

      const mrrWithoutTransactions = activeClientsThisMonth
        .filter(c => !clientTransactionIds.has(c.id))
        .reduce((acc, c) => acc + (Number(c.mrr) || 0), 0);

      const manualIncome = currentMonthTransactions
        .filter(t => t.type === 'income')
        .reduce((acc, t) => acc + (Number(t.amount) || 0), 0);

      const expenses = currentMonthTransactions
        .filter(t => t.type === 'expense')
        .reduce((acc, t) => acc + (Number(t.amount) || 0), 0);

      totalFaturamentoBruto += (mrrWithoutTransactions + manualIncome);
      totalExpenses += expenses;

      const monthOverdue = currentMonthTransactions.filter(t => t.status === 'overdue');
      totalOverdueAmount += monthOverdue.reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
      totalOverdueCount += monthOverdue.length;

      // Para o card de Receita MRR, usamos a média ou o valor do último mês selecionado? 
      // Geralmente quer-se ver a "capacidade" atual. Vamos somar e tirar média no final ou usar o valor do mês corrente no loop.
      latestMrrTotal += activeClientsThisMonth.reduce((acc, c) => acc + (Number(c.mrr) || 0), 0);
    });

    const faturamentoBruto = totalFaturamentoBruto;
    const expenses = totalExpenses;
    const lucroLiquido = faturamentoBruto - expenses;
    const margem = faturamentoBruto > 0 ? (lucroLiquido / faturamentoBruto) * 100 : 0;
    const mrrTotal = latestMrrTotal / effectiveMonths.length; // Média mensal do período

    // Projection remains for the month AFTER the latest selected month
    const latestMonth = Math.max(...effectiveMonths);
    const nextMonthDate = new Date(year, latestMonth, 1);
    const nextMonthStartDate = nextMonthDate.toISOString().split('T')[0];
    const nextMonthEndDate = new Date(year, latestMonth + 1, 0).toISOString().split('T')[0];

    const projecaoProximoMes = filteredClients
      .filter(c => {
        if (c.status !== 'active') return false;
        if (!c.start_date) return false;
        const startedBeforeEnd = c.start_date <= nextMonthEndDate;
        const endedAfterStart = !c.end_date || c.end_date === '' || c.end_date >= nextMonthStartDate;
        return startedBeforeEnd && endedAfterStart;
      })
      .reduce((acc, c) => acc + (Number(c.mrr) || 0), 0);

    return {
      mrrTotal, faturamentoBruto, expenses, lucroLiquido, margem, overdueAmount: totalOverdueAmount, overdueCount: totalOverdueCount, projecaoProximoMes
    };
  }, [filteredTransactions, filteredClients, selectedMonths, year]);

  // Chart Data Preparation (Year 12 Months Cash Flow)
  const cashFlowData = useMemo(() => {
    const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const isAllMonths = selectedMonths.includes('all' as any) || selectedMonths.length === 0;
    const effectiveMonths = isAllMonths ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] : selectedMonths;

    return monthNames.map((name, i) => {
      const loopMonth = i + 1;

      // Zera o mês no gráfico se não for um dos meses selecionados no filtro
      if (!effectiveMonths.includes(loopMonth)) {
        return { name, receita: 0, despesa: 0 };
      }

      const loopMonthEndDate = new Date(year, loopMonth, 0).toISOString().split('T')[0];

      const loopMonthTransactions = filteredTransactions.filter(t => {
        if (!t.due_date) return false;
        const tMonth = parseInt(t.due_date.split('-')[1], 10);
        const tYear = parseInt(t.due_date.split('-')[0], 10);
        return tMonth === loopMonth && tYear === year;
      });

      const clientTransactionIds = new Set(
        loopMonthTransactions
          .filter(t => t.client_id && t.type === 'income')
          .map(t => t.client_id)
      );

      // MRR active in loop month
      const loopActiveClients = filteredClients.filter(c => {
        if (c.status !== 'active') return false;
        if (!c.start_date) return false;
        const loopMonthStartDate = `${year}-${String(loopMonth).padStart(2, '0')}-01`;
        const startedBeforeEnd = c.start_date <= loopMonthEndDate;
        const endedAfterStart = !c.end_date || c.end_date === '' || c.end_date >= loopMonthStartDate;
        return startedBeforeEnd && endedAfterStart;
      });

      const loopMrrWithoutTransactions = loopActiveClients
        .filter(c => !clientTransactionIds.has(c.id))
        .reduce((acc, c) => acc + (Number(c.mrr) || 0), 0);

      const loopIncomeTransactions = loopMonthTransactions
        .filter(t => t.type === 'income')
        .reduce((acc, t) => acc + (Number(t.amount) || 0), 0);

      const loopExpenses = loopMonthTransactions
        .filter(t => t.type === 'expense')
        .reduce((acc, t) => acc + (Number(t.amount) || 0), 0);

      const loopFaturamentoTotal = loopMrrWithoutTransactions + loopIncomeTransactions;

      return {
        name,
        receita: loopFaturamentoTotal,
        despesa: loopExpenses
      };
    });
  }, [filteredTransactions, filteredClients, selectedMonths, year]);

  const categoryData = useMemo(() => {
    const categories: Record<string, number> = {};
    const isAllMonths = selectedMonths.includes('all' as any) || selectedMonths.length === 0;
    const effectiveMonths = isAllMonths ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] : selectedMonths;

    const currentMonthTransactions = filteredTransactions.filter(t => {
      if (!t.due_date) return false;
      const tMonth = parseInt(t.due_date.split('-')[1], 10);
      const tYear = parseInt(t.due_date.split('-')[0], 10);
      return effectiveMonths.includes(tMonth) && tYear === year;
    });

    currentMonthTransactions
      .filter(t => t.type === 'expense')
      .forEach(t => {
        categories[t.category] = (categories[t.category] || 0) + Number(t.amount);
      });

    return Object.entries(categories).map(([name, value]) => ({ name, value }));
  }, [filteredTransactions, selectedMonths, year]);

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

        <div className="flex items-center gap-2 bg-white/5 p-2 rounded-xl border border-white/10 flex-wrap">
          <Filter size={16} className="text-primary ml-1 flex-shrink-0" />
          <Select
            multiple
            value={selectedClientIds}
            onChange={(v) => setSelectedClientIds(v as string[])}
            options={[
              { value: 'all', label: 'Todos os Clientes' },
              ...clients.map(c => ({ value: c.id, label: c.name }))
            ]}
          />
          <div className="w-px h-5 bg-white/10 hidden sm:block" />
          <Select
            multiple
            value={selectedMonths}
            onChange={(v) => setSelectedMonths(v as number[])}
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
            options={[2024, 2025, 2026].map(y => ({ value: y, label: String(y) }))}
          />
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
                    label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}
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
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${t.status === 'paid' ? 'bg-green-500/20 text-green-400' :
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
