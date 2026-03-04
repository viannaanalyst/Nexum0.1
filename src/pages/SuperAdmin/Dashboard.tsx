import React, { useState } from 'react';
import { Plus, Building2, ExternalLink, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCompany, type Company } from '../../context/CompanyContext';
import { useNavigate } from 'react-router-dom';
import { IMaskInput } from 'react-imask';

const SuperAdminDashboard = () => {
  const { user, logout } = useAuth();
  const { companies, addCompany, selectCompany } = useCompany();
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newCompany, setNewCompany] = useState<Partial<Company>>({
    name: '',
    cnpj: '',
    whatsapp: '',
  });

  const handleCreateCompany = (e: React.FormEvent) => {
    e.preventDefault();
    if (newCompany.name && newCompany.cnpj) {
      addCompany(newCompany as Company);
      setIsModalOpen(false);
      setNewCompany({ name: '', cnpj: '', whatsapp: '' });
    }
  };

  const handleAccessPanel = (companyId: string) => {
    selectCompany(companyId);
    navigate('/');
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-[#0a0a1a] text-white font-sans p-8">
      {/* Background Layer */}
      <div 
        className="fixed inset-0 z-0 opacity-20 pointer-events-none"
        style={{
          backgroundImage: "url('https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1920&q=80')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      ></div>

      <div className="relative z-10 max-w-7xl mx-auto">
        <header className="flex items-center justify-between mb-12">
          <div>
            <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">
              Painel Super Admin
            </h1>
            <p className="text-gray-400 mt-2">Gerencie todas as empresas do sistema.</p>
          </div>
          <div className="flex items-center space-x-4">
             <div className="text-right mr-4">
                <p className="text-sm font-medium text-white">{user?.name}</p>
                <p className="text-xs text-gray-400 capitalize">{user?.role}</p>
             </div>
            <button 
              onClick={logout}
              className="p-2 text-gray-400 hover:text-white transition-colors bg-white/5 rounded-lg border border-white/10"
            >
              <LogOut size={20} />
            </button>
          </div>
        </header>

        <div className="flex justify-end mb-8">
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center space-x-2 bg-primary hover:bg-secondary text-white px-6 py-3 rounded-lg shadow-lg shadow-primary/20 transition-all duration-300 transform hover:scale-105"
          >
            <Plus size={20} />
            <span>Nova Empresa</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {companies.map((company) => (
            <div key={company.id} className="glass-card p-6 rounded-2xl border border-white/10 hover:border-primary/50 transition-all duration-300 group">
              <div className="flex items-start justify-between mb-6">
                <div className="p-3 bg-primary/10 rounded-xl">
                  <Building2 className="w-8 h-8 text-primary group-hover:scale-110 transition-transform duration-300" />
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium border ${
                  company.status === 'active' 
                    ? 'bg-green-500/10 text-green-400 border-green-500/20' 
                    : 'bg-red-500/10 text-red-400 border-red-500/20'
                }`}>
                  {company.status === 'active' ? 'Ativo' : 'Inativo'}
                </span>
              </div>

              <h3 className="text-xl font-bold text-white mb-2">{company.name}</h3>
              <div className="space-y-2 mb-6">
                <p className="text-sm text-gray-400 flex items-center">
                  <span className="w-20">CNPJ:</span> 
                  <span className="text-gray-300">{company.cnpj}</span>
                </p>
              </div>

              <button
                onClick={() => handleAccessPanel(company.id)}
                className="w-full flex items-center justify-center space-x-2 bg-white/5 hover:bg-white/10 text-white py-3 rounded-lg border border-white/10 transition-all duration-300 group-hover:border-primary/30"
              >
                <span>Acessar Painel</span>
                <ExternalLink size={16} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Modal Nova Empresa */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-lg p-8 rounded-2xl border border-white/10 relative">
            <h2 className="text-2xl font-bold text-white mb-6">Cadastrar Nova Empresa</h2>
            
            <form onSubmit={handleCreateCompany} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Nome da Empresa</label>
                <input
                  type="text"
                  required
                  value={newCompany.name}
                  onChange={e => setNewCompany({...newCompany, name: e.target.value})}
                  className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">CNPJ</label>
                <IMaskInput
                  mask="00.000.000/0000-00"
                  type="text"
                  required
                  value={newCompany.cnpj}
                  onAccept={(value: string) => setNewCompany({...newCompany, cnpj: value})}
                  className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="00.000.000/0000-00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">WhatsApp</label>
                <IMaskInput
                    mask="(00) 00000-0000"
                    type="text"
                    value={newCompany.whatsapp}
                    onAccept={(value: string) => setNewCompany({...newCompany, whatsapp: value})}
                    className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="(00) 00000-0000"
                />
              </div>

              <div className="flex space-x-4 mt-8 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-primary hover:bg-secondary text-white rounded-lg shadow-lg shadow-primary/20 transition-all"
                >
                  Criar Empresa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdminDashboard;
