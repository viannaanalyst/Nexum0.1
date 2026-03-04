import React, { useState, useMemo, useEffect } from 'react';
import { 
  Users, 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  PieChart as PieIcon,
  Calendar,
  ArrowRight,
  CheckCircle2,
  Clock,
  AlertCircle
} from 'lucide-react';
import { useCompany } from '../../context/CompanyContext';
import { supabase } from '../../lib/supabase';

// Types
interface Partner {
  id: string;
  name: string;
  percentage: number;
}

interface FinancialData {
  transactions: any[];
  clients: any[];
}

const FinanceiroComissoes = () => {
  const { selectedCompany } = useCompany();
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  
  const [partners, setPartners] = useState<Partner[]>([]);
  const [financialData, setFinancialData] = useState<FinancialData>({ transactions: [], clients: [] });

  // 1. Busca de Dados (Unificada)
  const fetchData = async () => {
    if (!selectedCompany) return;
    setLoading(true);
    try {
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const endDate = new Date(year, month, 0).toISOString().split('T')[0];

      const [partnersRes, transRes, clientsRes] = await Promise.all([
        supabase.from('company_partners').select('*').eq('company_id', selectedCompany.id),
        supabase.from('transactions').select('*').eq('company_id', selectedCompany.id).gte('due_date', startDate).lte('due_date', endDate),
        supabase.from('clients').select('id, mrr, status').eq('company_id', selectedCompany.id)
      ]);

      setPartners(partnersRes.data || []);
      setFinancialData({ transactions: transRes.data || [], clients: clientsRes.data || [] });
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [selectedCompany, month, year]);

  // 2. Lógica de Cálculo do Lucro (Mesma da Visão Geral)
  const results = useMemo(() => {
    const { transactions, clients } = financialData;
    
    // Identificar pagamentos de clientes para evitar duplicidade no MRR
    const clientTransactionIds = new Set(
      transactions
        .filter(t => t.type === 'income' && t.client_id)
        .map(t => t.client_id)
    );

    // MRR de clientes ativos sem pagamento manual
    const mrrTotal = clients
      .filter(c => c.status === 'active' && !clientTransactionIds.has(c.id))
      .reduce((acc, c) => acc + (Number(c.mrr) || 0), 0);

    // Receita Manual (Paga)
    const manualIncome = transactions
      .filter(t => t.type === 'income' && t.status === 'paid')
      .reduce((acc, t) => acc + (Number(t.amount) || 0), 0);

    // Custos Totais
    const expenses = transactions
      .filter(t => t.type === 'expense')
      .reduce((acc, t) => acc + (Number(t.amount) || 0), 0);

    const faturamentoBruto = mrrTotal + manualIncome;
    const lucroRealizado = faturamentoBruto - expenses;

    return { faturamentoBruto, expenses, lucroRealizado };
  }, [financialData]);

  if (!selectedCompany) return <div className="text-white p-8">Selecione uma empresa.</div>;

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto">
      {/* Header & Filtros */}
      <div className="flex flex-col md:flex-row justify-between items-center md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400">
            Comissões e Sócios
          </h1>
          <p className="text-gray-400 mt-2">Distribuição de lucros baseada no resultado real do mês.</p>
        </div>
        
        <div className="flex items-center space-x-4 bg-white/5 p-2 rounded-xl border border-white/10">
          <Calendar size={20} className="text-primary ml-2" />
          <select 
            value={month} 
            onChange={e => setMonth(Number(e.target.value))} 
            className="bg-transparent text-white border-none focus:ring-0 cursor-pointer outline-none"
          >
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i+1} value={i+1} className="bg-[#0a0a1a]">
                {new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(new Date(2000, i))}
              </option>
            ))}
          </select>
          <div className="w-px h-6 bg-white/10 mx-2"></div>
          <select 
            value={year} 
            onChange={e => setYear(Number(e.target.value))} 
            className="bg-transparent text-white border-none focus:ring-0 cursor-pointer outline-none"
          >
            {[2024, 2025, 2026].map(y => (
              <option key={y} value={y} className="bg-[#0a0a1a]">{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Painel de Indicadores Financeiros */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MiniCard 
          title="Faturamento Bruto" 
          value={results.faturamentoBruto} 
          color="text-green-400" 
          bg="bg-green-400/10"
          icon={<TrendingUp size={20} />} 
        />
        <MiniCard 
          title="Custos Totais" 
          value={results.expenses} 
          color="text-red-400" 
          bg="bg-red-400/10"
          icon={<TrendingDown size={20} />} 
        />
        <div className="glass-card p-6 rounded-2xl border border-primary/20 bg-primary/10 relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="text-primary" size={20} />
                <p className="text-primary text-xs font-bold uppercase tracking-widest">Lucro Realizado (Base)</p>
              </div>
              <h3 className="text-4xl font-black text-white mt-2">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(results.lucroRealizado)}
              </h3>
            </div>
        </div>
      </div>

      {/* Divisão por Sócios */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Card de Regras (CapTable) */}
        <div className="glass-card p-8 rounded-3xl border border-white/10 flex flex-col h-full">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-xl font-bold text-white flex items-center gap-3">
              <div className="p-2 bg-white/5 rounded-xl">
                <PieIcon className="text-primary" size={20} />
              </div>
              Regras de Distribuição
            </h2>
            <span className="text-xs text-gray-500 uppercase tracking-wider">CapTable</span>
          </div>
          
          <div className="space-y-6 flex-1">
            {partners.length > 0 ? partners.map(partner => (
              <div key={partner.id} className="space-y-2 group">
                <div className="flex justify-between text-sm items-end">
                  <span className="text-white font-medium group-hover:text-primary transition-colors">{partner.name}</span>
                  <span className="text-2xl font-bold text-white">{partner.percentage}<span className="text-sm text-gray-500 font-normal">%</span></span>
                </div>
                <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-primary to-secondary transition-all duration-1000 ease-out" 
                    style={{ width: `${partner.percentage}%` }} 
                  />
                </div>
              </div>
            )) : (
              <div className="text-center py-12 border border-dashed border-white/10 rounded-2xl bg-white/5">
                <p className="text-gray-400">Nenhum sócio configurado.</p>
                <p className="text-xs text-gray-500 mt-2">Configure em Configurações &gt; Regras Financeiras</p>
              </div>
            )}
          </div>
        </div>

        {/* Projeção de Repasse (Cards Verdes) */}
        <div className="space-y-6">
            <div className="flex items-center gap-3 px-2 mb-2">
                <div className="p-2 bg-emerald-500/20 rounded-xl">
                  <Users className="text-emerald-400" size={20} />
                </div>
                <h2 className="text-xl font-bold text-white">Repasse Individual</h2>
            </div>
            
            {partners.map(partner => {
                const valorRepasse = (results.lucroRealizado * (partner.percentage / 100));
                const isPositive = valorRepasse > 0;
                
                return (
                    <div 
                      key={partner.id} 
                      className={`glass-card p-6 rounded-3xl border transition-all duration-300 group relative overflow-hidden ${
                        isPositive 
                          ? 'border-emerald-500/20 bg-emerald-500/5 hover:border-emerald-500/40 hover:bg-emerald-500/10' 
                          : 'border-white/10 bg-white/5 opacity-70'
                      }`}
                    >
                        {/* Background Gradient Effect */}
                        {isPositive && (
                          <div className="absolute -right-20 -top-20 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl group-hover:bg-emerald-500/20 transition-all" />
                        )}

                        <div className="flex items-center justify-between relative z-10">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <p className={`text-xs font-bold uppercase tracking-wider ${isPositive ? 'text-emerald-400' : 'text-gray-400'}`}>
                                    {partner.name}
                                  </p>
                                  {isPositive && <CheckCircle2 size={14} className="text-emerald-500" />}
                                </div>
                                <h4 className={`text-3xl font-black ${isPositive ? 'text-white' : 'text-gray-500'}`}>
                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(isPositive ? valorRepasse : 0)}
                                </h4>
                                <p className="text-xs text-gray-500 mt-1">Disponível para retirada</p>
                            </div>
                            
                            <div className="text-right bg-black/20 p-3 rounded-xl border border-white/5 backdrop-blur-sm">
                                <p className="text-gray-500 text-[10px] uppercase mb-1">Participação</p>
                                <p className="text-white font-bold text-lg">{partner.percentage}%</p>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
      </div>
    </div>
  );
};

interface MiniCardProps {
  title: string;
  value: number;
  color: string;
  bg: string;
  icon: React.ReactNode;
}

const MiniCard = ({ title, value, color, bg, icon }: MiniCardProps) => (
  <div className="glass-card p-6 rounded-2xl border border-white/10 hover:border-white/20 transition-all">
    <div className="flex items-center gap-3 mb-4">
        <div className={`p-2.5 rounded-xl ${bg} ${color}`}>{icon}</div>
        <p className="text-gray-400 text-xs font-bold uppercase tracking-wider">{title}</p>
    </div>
    <h3 className="text-2xl font-bold text-white">
      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)}
    </h3>
  </div>
);

export default FinanceiroComissoes;
