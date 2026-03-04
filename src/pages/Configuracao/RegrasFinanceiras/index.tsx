import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Save, DollarSign } from 'lucide-react';
import { useCompany } from '../../../context/CompanyContext';
import { supabase } from '../../../lib/supabase';
import { IMaskInput } from 'react-imask';

interface Partner {
  id: string;
  name: string;
  percentage: number;
}

const RegrasFinanceiras = () => {
  const { selectedCompany } = useCompany();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (selectedCompany) {
      fetchPartners();
    }
  }, [selectedCompany]);

  const fetchPartners = async () => {
    try {
      if (!selectedCompany) return;
      
      const { data, error } = await supabase
        .from('company_partners')
        .select('*')
        .eq('company_id', selectedCompany.id);

      if (error) {
        // If table doesn't exist yet, we might want to handle it or create it via migration
        console.error('Error fetching partners:', error);
        return;
      }

      if (data) {
        setPartners(data);
      }
    } catch (error) {
      console.error('Error fetching partners:', error);
    }
  };

  const handleAddPartner = () => {
    setPartners([...partners, { id: `temp-${Date.now()}`, name: '', percentage: 0 }]);
  };

  const handleRemovePartner = async (id: string) => {
    if (id.startsWith('temp-')) {
      setPartners(partners.filter(p => p.id !== id));
    } else {
      try {
        const { error } = await supabase
          .from('company_partners')
          .delete()
          .eq('id', id);
        
        if (error) throw error;
        setPartners(partners.filter(p => p.id !== id));
      } catch (error) {
        console.error('Error removing partner:', error);
        alert('Erro ao remover sócio.');
      }
    }
  };

  const handleUpdatePartner = (id: string, field: keyof Partner, value: any) => {
    setPartners(partners.map(p => {
      if (p.id === id) {
        return { ...p, [field]: value };
      }
      return p;
    }));
  };

  const handleSave = async () => {
    if (!selectedCompany) return;
    setLoading(true);

    const totalPercentage = partners.reduce((sum, p) => sum + Number(p.percentage), 0);
    if (totalPercentage !== 100 && partners.length > 0) {
      alert(`A soma das porcentagens deve ser 100%. Atual: ${totalPercentage}%`);
      setLoading(false);
      return;
    }

    try {
      // Upsert partners
      const partnersToSave = partners.map(p => {
        const { id, ...rest } = p;
        const partnerData: any = {
          ...rest,
          company_id: selectedCompany.id,
        };
        // If it's not a temp ID, include it to update
        if (!id.startsWith('temp-')) {
          partnerData.id = id;
        }
        return partnerData;
      });

      const { error } = await supabase
        .from('company_partners')
        .upsert(partnersToSave);

      if (error) throw error;

      alert('Sócios salvos com sucesso!');
      fetchPartners(); // Refresh IDs
    } catch (error) {
      console.error('Error saving partners:', error);
      alert('Erro ao salvar sócios. Verifique se a tabela existe.');
    } finally {
      setLoading(false);
    }
  };

  if (!selectedCompany) return <div className="text-white">Selecione uma empresa.</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400">
            Regras Financeiras
          </h1>
          <p className="text-gray-400 mt-2">Defina a estrutura societária e regras de distribuição.</p>
        </div>
        <button 
          onClick={handleSave}
          disabled={loading}
          className="flex items-center space-x-2 bg-primary hover:bg-secondary text-white px-6 py-3 rounded-lg shadow-lg shadow-primary/20 transition-all duration-300 transform hover:scale-105"
        >
          <Save size={20} />
          <span>{loading ? 'Salvando...' : 'Salvar Alterações'}</span>
        </button>
      </div>

      <div className="glass-card p-8 rounded-2xl border border-white/10">
        <div className="flex items-center justify-between mb-6 border-b border-white/10 pb-4">
          <h2 className="text-xl font-semibold text-white flex items-center space-x-2">
            <DollarSign className="text-green-400" />
            <span>Estrutura Societária (CapTable)</span>
          </h2>
          <button 
            onClick={handleAddPartner}
            className="flex items-center space-x-1 text-sm bg-white/5 hover:bg-white/10 text-white px-3 py-2 rounded-lg transition-colors border border-white/10"
          >
            <Plus size={16} />
            <span>Adicionar Sócio</span>
          </button>
        </div>

        <div className="space-y-4">
          {partners.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              Nenhum sócio cadastrado. Adicione um sócio para começar.
            </div>
          ) : (
            partners.map((partner) => (
              <div key={partner.id} className="flex items-center space-x-4 p-4 bg-black/20 rounded-xl border border-white/5 group hover:border-white/10 transition-colors">
                <div className="flex-1">
                  <label className="block text-xs text-gray-500 mb-1">Nome do Sócio</label>
                  <input
                    type="text"
                    value={partner.name}
                    onChange={(e) => handleUpdatePartner(partner.id, 'name', e.target.value)}
                    className="w-full bg-transparent text-white border-b border-white/10 focus:border-primary outline-none py-1 transition-colors"
                    placeholder="Nome completo"
                  />
                </div>
                <div className="w-32">
                  <label className="block text-xs text-gray-500 mb-1">Porcentagem (%)</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={partner.percentage}
                      onChange={(e) => handleUpdatePartner(partner.id, 'percentage', parseFloat(e.target.value))}
                      className="w-full bg-transparent text-white border-b border-white/10 focus:border-primary outline-none py-1 transition-colors pr-6 text-right"
                      placeholder="0"
                      min="0"
                      max="100"
                      step="0.01"
                    />
                    <span className="absolute right-0 top-1/2 -translate-y-1/2 text-gray-500">%</span>
                  </div>
                </div>
                <div className="pt-4">
                  <button 
                    onClick={() => handleRemovePartner(partner.id)}
                    className="text-gray-500 hover:text-red-400 transition-colors p-2"
                    title="Remover sócio"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {partners.length > 0 && (
          <div className="mt-6 pt-4 border-t border-white/10 flex justify-end">
            <div className="flex items-center space-x-2 text-sm">
              <span className="text-gray-400">Total:</span>
              <span className={`font-bold ${
                partners.reduce((sum, p) => sum + Number(p.percentage), 0) === 100 
                  ? 'text-green-400' 
                  : 'text-red-400'
              }`}>
                {partners.reduce((sum, p) => sum + Number(p.percentage), 0).toFixed(2)}%
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RegrasFinanceiras;
