import React, { useState, useEffect } from 'react';
import { Save, Building2, Phone, Mail, FileText } from 'lucide-react';
import { useCompany } from '../../context/CompanyContext';
import { IMaskInput } from 'react-imask';
import { supabase } from '../../lib/supabase';
import { useUI } from '../../context/UIContext';

const Empresa = () => {
  const { selectedCompany, updateCompany } = useCompany();
  const { toast } = useUI();
  const [formData, setFormData] = useState({
    nome: '',
    cnpj: '',
    whatsapp: '',
    email: ''
  });
  const [membersCount, setMembersCount] = useState(0);

  useEffect(() => {
    if (selectedCompany) {
      setFormData({
        nome: selectedCompany.name || '',
        cnpj: selectedCompany.cnpj || '',
        whatsapp: selectedCompany.whatsapp || '',
        email: selectedCompany.email || ''
      });
      fetchMembersCount();
    }
  }, [selectedCompany]);

  const fetchMembersCount = async () => {
    if (!selectedCompany) return;
    try {
      const { count, error } = await supabase
        .from('organization_members')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', selectedCompany.id);

      if (error) {
        console.error('Error fetching members count (Supabase):', error);
      } else {
        // If count is null (e.g. no permission), default to 0
        setMembersCount(count || 0);
      }
    } catch (error) {
      console.error('Error fetching members count (Catch):', error);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedCompany) {
      updateCompany(selectedCompany.id, {
        name: formData.nome,
        cnpj: formData.cnpj,
        whatsapp: formData.whatsapp,
        email: formData.email
      });
      toast.success('Dados da empresa atualizados com sucesso!', 'Sucesso');
    }
  };

  if (!selectedCompany) {
    return <div className="text-white">Nenhuma empresa selecionada.</div>
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex-1"></div>
        <button
          onClick={handleSubmit}
          className="flex items-center space-x-2 bg-primary hover:bg-secondary text-white px-6 py-3 rounded-lg shadow-lg shadow-primary/20 transition-all duration-300 transform hover:scale-105"
        >
          <Save size={20} />
          <span>Salvar Alterações</span>
        </button>
      </div>

      <div className="glass-card p-8 rounded-2xl border border-white/10 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -z-10 transform translate-x-1/2 -translate-y-1/2"></div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-white flex items-center space-x-2 border-b border-white/10 pb-4">
              <Building2 className="text-primary" />
              <span>Dados Gerais</span>
            </h2>

            <div className="space-y-4">
              <div className="group">
                <label className="block text-sm font-medium text-gray-400 mb-1 group-focus-within:text-primary transition-colors">
                  Nome da Empresa
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Building2 className="h-5 w-5 text-gray-500 group-focus-within:text-primary transition-colors" />
                  </div>
                  <input
                    type="text"
                    name="nome"
                    value={formData.nome}
                    onChange={handleChange}
                    className="block w-full pl-10 pr-3 py-3 bg-black/20 border border-white/10 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all duration-300 hover:bg-black/30"
                    placeholder="Digite o nome da empresa"
                  />
                </div>
              </div>

              <div className="group">
                <label className="block text-sm font-medium text-gray-400 mb-1 group-focus-within:text-primary transition-colors">
                  CNPJ
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
                    <FileText className="h-5 w-5 text-gray-500 group-focus-within:text-primary transition-colors" />
                  </div>
                  <IMaskInput
                    mask="00.000.000/0000-00"
                    value={formData.cnpj}
                    onAccept={(value: string) => setFormData(prev => ({ ...prev, cnpj: value }))}
                    className="block w-full pl-10 pr-3 py-3 bg-black/20 border border-white/10 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all duration-300 hover:bg-black/30"
                    placeholder="00.000.000/0001-00"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-white flex items-center space-x-2 border-b border-white/10 pb-4">
              <Phone className="text-secondary" />
              <span>Contato</span>
            </h2>

            <div className="space-y-4">
              <div className="group">
                <label className="block text-sm font-medium text-gray-400 mb-1 group-focus-within:text-secondary transition-colors">
                  WhatsApp
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
                    <Phone className="h-5 w-5 text-gray-500 group-focus-within:text-secondary transition-colors" />
                  </div>
                  <IMaskInput
                    mask="(00) 00000-0000"
                    value={formData.whatsapp}
                    onAccept={(value: string) => setFormData(prev => ({ ...prev, whatsapp: value }))}
                    className="block w-full pl-10 pr-3 py-3 bg-black/20 border border-white/10 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-secondary/50 focus:border-secondary transition-all duration-300 hover:bg-black/30"
                    placeholder="(00) 00000-0000"
                  />
                </div>
              </div>

              <div className="group">
                <label className="block text-sm font-medium text-gray-400 mb-1 group-focus-within:text-secondary transition-colors">
                  Email Corporativo
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-gray-500 group-focus-within:text-secondary transition-colors" />
                  </div>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className="block w-full pl-10 pr-3 py-3 bg-black/20 border border-white/10 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-secondary/50 focus:border-secondary transition-all duration-300 hover:bg-black/30"
                    placeholder="contato@empresa.com"
                  />
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>

      {/* Visual Stats or Info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-card p-6 rounded-xl border border-white/5 bg-gradient-to-br from-white/5 to-transparent">
          <div className="text-gray-400 text-sm mb-1">Status da Conta</div>
          <div className={`text-2xl font-bold flex items-center ${selectedCompany.status === 'active' ? 'text-green-400' : 'text-red-400'
            }`}>
            <span className={`w-2 h-2 rounded-full mr-2 ${selectedCompany.status === 'active' ? 'bg-green-500 animate-pulse' : 'bg-red-500'
              }`}></span>
            {selectedCompany.status === 'active' ? 'Ativo' : 'Inativo'}
          </div>
        </div>
        <div className="glass-card p-6 rounded-xl border border-white/5 bg-gradient-to-br from-white/5 to-transparent">
          <div className="text-gray-400 text-sm mb-1">Plano Atual</div>
          <div className="text-2xl font-bold text-white capitalize">{selectedCompany.plan}</div>
        </div>
        <div className="glass-card p-6 rounded-xl border border-white/5 bg-gradient-to-br from-white/5 to-transparent">
          <div className="text-gray-400 text-sm mb-1">Membros</div>
          <div className="text-2xl font-bold text-white">{membersCount}</div>
        </div>
      </div>
    </div>
  );
};

export default Empresa;
