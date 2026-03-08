import React, { useState, useEffect } from 'react';
import { Plus, Building2, ExternalLink, LogOut, Loader2, Bug, Lightbulb, Link as LinkIcon, Image as ImageIcon, CheckCircle2, AlertCircle, Clock, User as UserIcon, Building2 as CompanyIcon, ChevronRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCompany, type Company } from '../../context/CompanyContext';
import { useNavigate } from 'react-router-dom';
import { IMaskInput } from 'react-imask';
import { supabase } from '../../lib/supabase';

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
  const [activeTab, setActiveTab] = useState<'companies' | 'tickets'>('companies');
  const [tickets, setTickets] = useState<any[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);

  const fetchTickets = async () => {
    setLoadingTickets(true);
    try {
      const { data, error } = await supabase
        .from('support_tickets')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setTickets(data || []);
    } catch (error) {
      console.error('Error fetching tickets:', error);
    } finally {
      setLoadingTickets(false);
    }
  };

  React.useEffect(() => {
    if (activeTab === 'tickets') {
      fetchTickets();
    }
  }, [activeTab]);

  const handleUpdateTicketStatus = async (ticketId: string, status: string) => {
    try {
      const { error } = await supabase
        .from('support_tickets')
        .update({ status })
        .eq('id', ticketId);
      
      if (error) throw error;
      setTickets(tickets.map(t => t.id === ticketId ? { ...t, status } : t));
    } catch (error) {
      console.error('Error updating ticket status:', error);
    }
  };

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
          <div className="flex-1"></div>
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

        <div className="flex items-center justify-between mb-8">
          <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
            <button
              onClick={() => setActiveTab('companies')}
              className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'companies' ? 'bg-primary text-white shadow-lg' : 'text-gray-400 hover:text-white'
              }`}
            >
              Empresas
            </button>
            <button
              onClick={() => setActiveTab('tickets')}
              className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'tickets' ? 'bg-primary text-white shadow-lg' : 'text-gray-400 hover:text-white'
              }`}
            >
              Chamados de Suporte
            </button>
          </div>

          {activeTab === 'companies' && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center space-x-2 bg-primary hover:bg-secondary text-white px-6 py-3 rounded-lg shadow-lg shadow-primary/20 transition-all duration-300 transform hover:scale-105"
            >
              <Plus size={20} />
              <span>Nova Empresa</span>
            </button>
          )}
        </div>

        {activeTab === 'companies' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {companies.map((company) => (
              <div key={company.id} className="glass-card p-6 rounded-2xl border border-white/10 hover:border-primary/50 transition-all duration-300 group">
                <div className="flex items-start justify-between mb-6">
                  <div className="p-3 bg-primary/10 rounded-xl">
                    <CompanyIcon className="w-8 h-8 text-primary group-hover:scale-110 transition-transform duration-300" />
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium border ${company.status === 'active'
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
        ) : (
          <div className="space-y-6">
            {loadingTickets ? (
              <div className="text-center py-20">
                <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto mb-4" />
                <p className="text-gray-400">Carregando chamados...</p>
              </div>
            ) : tickets.length > 0 ? (
              tickets.map((ticket) => (
                <div key={ticket.id} className="glass-card p-6 rounded-2xl border border-white/10 hover:border-white/20 transition-all">
                  <div className="flex flex-col md:flex-row gap-6">
                    {/* Ticket Header & Status */}
                    <div className="md:w-64 shrink-0">
                      <div className="flex items-center gap-2 mb-4">
                        {ticket.type === 'bug' ? (
                          <div className="p-2 bg-red-500/10 text-red-500 rounded-lg border border-red-500/20">
                            <Bug size={18} />
                          </div>
                        ) : (
                          <div className="p-2 bg-primary/10 text-primary rounded-lg border border-primary/20">
                            <Lightbulb size={18} />
                          </div>
                        )}
                        <div>
                          <p className={`text-[10px] font-bold uppercase tracking-wider ${ticket.type === 'bug' ? 'text-red-500' : 'text-primary'}`}>
                            {ticket.type}
                          </p>
                          <p className="text-xs text-gray-500">{new Date(ticket.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-sm">
                          <UserIcon size={14} className="text-gray-500" />
                          <span className="text-gray-300">{ticket.user_name || 'Usuário'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <CompanyIcon size={14} className="text-gray-500" />
                          <span className="text-gray-300">{ticket.company_name || 'Empresa'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm truncate">
                          <LinkIcon size={14} className="text-gray-500 shrink-0" />
                          <a href={ticket.page_url} target="_blank" rel="noreferrer" className="text-primary hover:underline truncate">Ver página</a>
                        </div>
                      </div>

                      <div className="mt-6 space-y-2">
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Status</p>
                        <select
                          value={ticket.status}
                          onChange={(e) => handleUpdateTicketStatus(ticket.id, e.target.value)}
                          className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-primary"
                        >
                          <option value="open">Aberto</option>
                          <option value="in_progress">Em Progresso</option>
                          <option value="resolved">Resolvido</option>
                          <option value="closed">Fechado</option>
                        </select>
                      </div>
                    </div>

                    {/* Ticket Content */}
                    <div className="flex-1 space-y-4">
                      {ticket.title && (
                        <h4 className="text-lg font-bold text-white tracking-tight">{ticket.title}</h4>
                      )}
                      
                      <div className="bg-white/5 rounded-xl p-5 border border-white/5">
                        <p className="text-white text-sm leading-relaxed whitespace-pre-wrap">{ticket.description}</p>
                      </div>

                      {ticket.screenshot_url && (
                        <div>
                          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1 mb-2">Screenshot</p>
                          <a href={ticket.screenshot_url} target="_blank" rel="noreferrer" className="block relative group overflow-hidden rounded-xl border border-white/10 max-w-md hover:border-primary/50 transition-all">
                            <img src={ticket.screenshot_url} alt="Screenshot" className="w-full h-auto" />
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <span className="bg-primary px-4 py-2 rounded-lg text-white text-xs font-bold flex items-center gap-2">
                                <ImageIcon size={14} />
                                Ver imagem completa
                              </span>
                            </div>
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-20 bg-white/5 rounded-2xl border border-dashed border-white/10">
                <CheckCircle2 className="w-12 h-12 text-gray-700 mx-auto mb-4" />
                <h4 className="text-gray-400 font-medium tracking-wide">Nenhum chamado pendente</h4>
                <p className="text-xs text-gray-600 mt-1">Tudo em ordem por aqui!</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal Nova Empresa */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* 1. Overlay Premium */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-md z-0 animate-in fade-in duration-300"
            onClick={() => setIsModalOpen(false)}
          >
            <div className="absolute inset-0 opacity-[0.03] bg-[url('https://grainy-gradients.vercel.app/noise.svg')]"></div>
          </div>

          {/* 2. Container Glass Premium */}
          <div className="relative z-10 w-full max-w-lg rounded-[22px] overflow-hidden shadow-[0_32px_64px_-12px_rgba(0,0,0,0.6)] animate-in zoom-in-95 duration-300 border border-white/10 bg-[#0a0a1a]/10 backdrop-blur-xl ring-1 ring-white/10 ring-inset">

            {/* Grain Texture Overlay */}
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')] z-0"></div>

            {/* Glow Effects */}
            <div className="absolute inset-0 rounded-[22px] border border-white/5 pointer-events-none"></div>
            <div className="absolute top-[-50px] left-1/2 -translate-x-1/2 w-[60%] h-[100px] bg-primary/30 blur-[80px] pointer-events-none rounded-[100%]"></div>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/3 h-[1px] bg-gradient-to-r from-transparent via-primary/50 to-transparent"></div>

            <div className="p-8 pb-4 relative z-20">
              <h2 className="text-xl font-bold text-[#EEEEEE] mb-1">Cadastrar Nova Empresa</h2>
              <p className="text-xs text-[#6e6e6e] font-light">Adicione uma nova organização ao sistema.</p>
            </div>

            <form onSubmit={handleCreateCompany} className="p-8 pt-2 space-y-5 relative z-20">
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide ml-1">Nome da Empresa</label>
                <input
                  type="text"
                  required
                  value={newCompany.name}
                  onChange={e => setNewCompany({ ...newCompany, name: e.target.value })}
                  className="w-full bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] rounded-xl px-4 py-3 text-white/90 focus:bg-white/[0.08] focus:border-primary/30 focus:ring-0 outline-none transition-all duration-300 text-sm font-light placeholder-[#6e6e6e]"
                  placeholder="Nome da empresa"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide ml-1">CNPJ</label>
                <IMaskInput
                  mask="00.000.000/0000-00"
                  type="text"
                  required
                  value={newCompany.cnpj}
                  onAccept={(value: string) => setNewCompany({ ...newCompany, cnpj: value })}
                  className="w-full bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] rounded-xl px-4 py-3 text-white/90 focus:bg-white/[0.08] focus:border-primary/30 focus:ring-0 outline-none transition-all duration-300 text-sm font-light placeholder-[#6e6e6e]"
                  placeholder="00.000.000/0000-00"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide ml-1">WhatsApp</label>
                <IMaskInput
                  mask="(00) 00000-0000"
                  type="text"
                  value={newCompany.whatsapp}
                  onAccept={(value: string) => setNewCompany({ ...newCompany, whatsapp: value })}
                  className="w-full bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] rounded-xl px-4 py-3 text-white/90 focus:bg-white/[0.08] focus:border-primary/30 focus:ring-0 outline-none transition-all duration-300 text-sm font-light placeholder-gray-600"
                  placeholder="(00) 00000-0000"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-white/5 mt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 text-sm text-gray-500 hover:text-white transition-colors hover:bg-white/5 rounded-xl font-light"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-white/[0.05] hover:bg-white/[0.1] text-white rounded-xl border border-white/5 hover:border-white/20 transition-all duration-300 font-medium text-sm flex items-center gap-2 group shadow-lg"
                >
                  <span>Criar Empresa</span>
                  <span className="text-primary group-hover:translate-x-1 transition-transform">→</span>
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
