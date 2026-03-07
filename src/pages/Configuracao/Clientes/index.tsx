import React, { useState, useEffect } from 'react';
import {
  Plus, Search, Edit2, Trash2, User, DollarSign,
  Briefcase, Users, Target, History, Save, X, Eye, EyeOff,
  CheckCircle, AlertCircle, Lock, Copy
} from 'lucide-react';
import { useCompany } from '../../../context/CompanyContext';
import { useAuth } from '../../../context/AuthContext';
import { supabase } from '../../../lib/supabase';
import { IMaskInput } from 'react-imask';
import { useUI } from '../../../context/UIContext';
import './styles.css';

// Types
interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  website: string;
  instagram: string;
  briefing: string;
  start_date?: string;
  end_date?: string;
  status: 'active' | 'paused' | 'canceled';
  mrr: number;
  due_day: number;
  payment_reminder: boolean;
  services: string[];
  scope_description: string;
  strategic_goals: string[];
  team_members?: string[]; // IDs for UI logic
}

interface TeamMember {
  id: string;
  name: string;
}

interface Credential {
  id: string;
  service_name: string;
  login: string;
  password?: string; // Decrypted
  notes: string;
  created_at: string;
}

interface Log {
  id: string;
  previous_status: string;
  new_status: string;
  changed_at: string;
  changed_by: string; // User ID
  user_name?: string; // Fetched name
}

const Clientes = () => {
  const { toast, confirm } = useUI();
  const { selectedCompany } = useCompany();
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('dados');
  const [companyMembers, setCompanyMembers] = useState<TeamMember[]>([]);

  // New States for features
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [newCredential, setNewCredential] = useState({ service_name: '', login: '', password: '', notes: '' });
  const [showPassword, setShowPassword] = useState<Record<string, boolean>>({});

  // Initial Form State
  const initialFormState: Client = {
    id: '',
    name: '',
    email: '',
    phone: '',
    website: '',
    instagram: '',
    briefing: '',
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
    status: 'active',
    mrr: 0,
    due_day: 5,
    payment_reminder: true,
    services: [],
    scope_description: '',
    strategic_goals: [],
    team_members: []
  };

  const [formData, setFormData] = useState<Client>(initialFormState);
  const [editingId, setEditingId] = useState<string | null>(null);

  // New States for custom items
  const [newService, setNewService] = useState('');
  const [newGoal, setNewGoal] = useState('');
  const [customServices, setCustomServices] = useState<string[]>([]);
  const [customGoals, setCustomGoals] = useState<string[]>([]);

  const defaultServices = ['Gestão de Tráfego', 'Social Media', 'Design', 'Web Development', 'Consultoria', 'SEO', 'Email Marketing'];
  const defaultGoals = ['Aumento de Leads', 'Branding', 'Vendas E-commerce', 'Engajamento', 'Retenção', 'Lançamento'];

  // Combine default + custom
  const allServices = [...defaultServices, ...customServices];
  const allGoals = [...defaultGoals, ...customGoals];

  const handleAddCustomItem = (type: 'service' | 'goal') => {
    if (type === 'service' && newService) {
      if (!allServices.includes(newService)) {
        setCustomServices([...customServices, newService]);
        toggleArrayItem('services', newService); // Auto-select
      }
      setNewService('');
    } else if (type === 'goal' && newGoal) {
      if (!allGoals.includes(newGoal)) {
        setCustomGoals([...customGoals, newGoal]);
        toggleArrayItem('strategic_goals', newGoal); // Auto-select
      }
      setNewGoal('');
    }
  };

  useEffect(() => {
    const handleGlobalNewClient = () => {
      handleOpenModal();
    };

    window.addEventListener('open-new-client', handleGlobalNewClient);
    return () => window.removeEventListener('open-new-client', handleGlobalNewClient);
  }, []);

  // Fetch Data
  useEffect(() => {
    if (selectedCompany) {
      fetchClients();
      fetchCompanyMembers();
    }
  }, [selectedCompany]);

  // Fetch extra data when opening a client
  useEffect(() => {
    if (editingId) {
      fetchCredentials(editingId);
      fetchLogs(editingId);
    } else {
      setCredentials([]);
      setLogs([]);
    }
  }, [editingId]);

  const fetchClients = async () => {
    try {
      if (!selectedCompany || !user) return;

      let clientIdsToFetch: string[] | null = null;

      // Check permissions
      // Assuming 'admin' and 'SUPER ADMIN' roles see everything.
      // 'editor' and 'visualizador' only see assigned clients.
      const isUserAdmin = user.role === 'admin' || user.role === 'SUPER ADMIN' || user.is_super_admin;

      if (!isUserAdmin) {
        const { data: myAllocations } = await supabase
          .from('client_team')
          .select('client_id')
          .eq('user_id', user.id);

        if (myAllocations && myAllocations.length > 0) {
          clientIdsToFetch = myAllocations.map(a => a.client_id);
        } else {
          // User has no clients assigned
          setClients([]);
          return;
        }
      }

      // Fetch clients
      let query = supabase
        .from('clients')
        .select('*')
        .eq('company_id', selectedCompany.id)
        .order('name');

      if (clientIdsToFetch !== null) {
        query = query.in('id', clientIdsToFetch);
      }

      const { data: clientsData, error: clientsError } = await query;

      if (clientsError) throw clientsError;

      if (clientsData) {
        // Fetch team members for these clients (UI Logic)
        const clientIds = clientsData.map(c => c.id);
        const { data: teamData, error: teamError } = await supabase
          .from('client_team')
          .select('client_id, user_id')
          .in('client_id', clientIds);

        if (teamError) throw teamError;

        // Merge
        const clientsWithTeam = clientsData.map(client => {
          const members = teamData
            ?.filter(t => t.client_id === client.id)
            .map(t => t.user_id) || [];
          return { ...client, team_members: members };
        });

        setClients(clientsWithTeam);
      }
    } catch (error) {
      console.error('Error fetching clients:', error);
    }
  };

  const fetchCompanyMembers = async () => {
    try {
      if (!selectedCompany) return;
      const { data: members } = await supabase
        .from('organization_members')
        .select('user_id')
        .eq('company_id', selectedCompany.id);

      if (members && members.length > 0) {
        const userIds = members.map(m => m.user_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', userIds);

        if (profiles) {
          setCompanyMembers(profiles.map(p => ({ id: p.id, name: p.full_name || 'Sem nome' })));
        }
      }
    } catch (error) {
      console.error('Error fetching members:', error);
    }
  };

  // --- Credentials Logic ---
  const fetchCredentials = async (clientId: string) => {
    try {
      const { data, error } = await supabase
        .rpc('get_client_credentials', { p_client_id: clientId });

      if (error) throw error;
      if (data) setCredentials(data);
    } catch (error) {
      console.error('Error fetching credentials:', error);
    }
  };

  const handleAddCredential = async () => {
    if (!editingId) return;
    if (!newCredential.service_name || !newCredential.login || !newCredential.password) {
      toast.warning('Atenção', 'Preencha os campos obrigatórios da credencial.');
      return;
    }

    try {
      const { error } = await supabase.rpc('add_client_credential', {
        p_client_id: editingId,
        p_service_name: newCredential.service_name,
        p_login: newCredential.login,
        p_password: newCredential.password,
        p_notes: newCredential.notes
      });

      if (error) throw error;

      setNewCredential({ service_name: '', login: '', password: '', notes: '' });
      fetchCredentials(editingId);
      toast.success('Sucesso', 'Credencial adicionada com segurança!');
    } catch (error: any) {
      console.error('Error adding credential:', error);
      toast.error('Erro', 'Erro ao adicionar credencial: ' + error.message);
    }
  };

  const handleDeleteCredential = async (id: string) => {
    if (!await confirm('Remover Credencial', 'Tem certeza que deseja remover esta credencial?', { type: 'danger' })) return;
    try {
      const { error } = await supabase.rpc('delete_client_credential', { p_credential_id: id });
      if (error) throw error;
      setCredentials(prev => prev.filter(c => c.id !== id));
      toast.success('Sucesso', 'Credencial removida!');
    } catch (error) {
      console.error('Error deleting credential:', error);
      toast.error('Erro', 'Erro ao remover credencial.');
    }
  };

  // --- Logs Logic ---
  const fetchLogs = async (clientId: string) => {
    try {
      const { data, error } = await supabase
        .from('client_logs')
        .select('*')
        .eq('client_id', clientId)
        .order('changed_at', { ascending: false });

      if (error) throw error;

      if (data) {
        // Fetch user names
        const userIds = [...new Set(data.map(l => l.changed_by).filter(Boolean))];
        const { data: users } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', userIds);

        const logsWithNames = data.map(log => ({
          ...log,
          user_name: users?.find(u => u.id === log.changed_by)?.full_name || 'Sistema'
        }));

        setLogs(logsWithNames);
      }
    } catch (error) {
      console.error('Error fetching logs:', error);
    }
  };

  const handleOpenModal = (client?: Client) => {
    if (client) {
      setFormData(client);
      setEditingId(client.id);
    } else {
      setFormData(initialFormState);
      setEditingId(null);
    }
    setActiveTab('dados');
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!selectedCompany) return;
    setLoading(true);
    try {
      const { id, team_members, ...dataToSave } = formData;

      // Convert empty strings to null for date fields
      if (dataToSave.start_date === '') delete (dataToSave as any).start_date;
      if (dataToSave.end_date === '') (dataToSave as any).end_date = null;

      let result;
      if (editingId) {
        // Update
        result = await supabase
          .from('clients')
          .update(dataToSave)
          .eq('id', editingId)
          .select()
          .single();
      } else {
        // Create
        result = await supabase
          .from('clients')
          .insert({ ...dataToSave, company_id: selectedCompany.id })
          .select()
          .single();
      }

      if (result.error) throw result.error;

      // Handle Team Members (Many-to-Many)
      if (result.data) {
        const clientId = result.data.id;

        // Clear existing
        await supabase.from('client_team').delete().eq('client_id', clientId);

        // Insert new
        if (team_members && team_members.length > 0) {
          const teamInserts = team_members.map(uid => ({
            client_id: clientId,
            user_id: uid
          }));
          await supabase.from('client_team').insert(teamInserts);
        }

        // If creating new, set editing ID to allow adding credentials immediately
        if (!editingId) {
          setEditingId(clientId);
          toast.success('Sucesso', 'Cliente criado! Agora você pode adicionar credenciais.');
        } else {
          toast.success('Sucesso', 'Cliente salvo com sucesso!');
          setIsModalOpen(false);
        }
      }
      fetchClients();
    } catch (error: any) {
      console.error('Error saving client:', error);
      toast.error('Erro', 'Erro ao salvar cliente: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Helper for array fields
  const toggleArrayItem = (field: 'services' | 'strategic_goals' | 'team_members', value: string) => {
    const current = formData[field] || [];
    const updated = current.includes(value)
      ? current.filter(item => item !== value)
      : [...current, value];
    setFormData({ ...formData, [field]: updated });
  };

  if (!selectedCompany) return <div className="text-white">Selecione uma empresa.</div>;

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex-1"></div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center space-x-2 bg-primary hover:bg-secondary text-white px-6 py-3 rounded-lg shadow-lg shadow-primary/20 transition-all duration-300 transform hover:scale-105"
        >
          <Plus size={20} />
          <span>Novo cliente</span>
        </button>
      </div>

      {/* List */}
      <div className="glass-card rounded-2xl border border-white/10 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-white/5 text-gray-400 text-sm uppercase tracking-wider">
              <th className="px-6 py-4 font-medium">Cliente</th>
              <th className="px-6 py-4 font-medium">Status</th>
              <th className="px-6 py-4 font-medium">MRR</th>
              <th className="px-6 py-4 font-medium">Serviços</th>
              <th className="px-6 py-4 font-medium text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {clients.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-8 text-gray-500">Nenhum cliente cadastrado.</td></tr>
            ) : (
              clients.map(client => (
                <tr key={client.id} className="hover:bg-white/5 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="font-medium text-white">{client.name}</div>
                    <div className="text-xs text-gray-500">{client.email}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${client.status === 'active' ? 'bg-green-500/20 text-green-400' :
                      client.status === 'paused' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-red-500/20 text-red-400'
                      }`}>
                      {client.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-white font-mono">
                    R$ {client.mrr?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-400">
                    {client.services?.length || 0} serviços
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => handleOpenModal(client)} className="text-gray-400 hover:text-white mr-3"><Edit2 size={18} /></button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* 1. Overlay Premium */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-md z-0 animate-in fade-in duration-300"
            onClick={() => setIsModalOpen(false)}
          >
            <div className="absolute inset-0 opacity-[0.03] bg-[url('https://grainy-gradients.vercel.app/noise.svg')]"></div>
          </div>

          {/* 2. Container Glass Premium */}
          <div className="relative z-10 w-full max-w-5xl h-[85vh] flex flex-col rounded-[22px] overflow-hidden shadow-[0_32px_64px_-12px_rgba(0,0,0,0.6)] animate-in zoom-in-95 duration-300 border border-white/10 bg-[#0a0a1a]/10 backdrop-blur-xl ring-1 ring-white/10 ring-inset">

            {/* Grain Texture Overlay */}
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')] z-0"></div>

            {/* Glow Effects */}
            <div className="absolute inset-0 rounded-[22px] border border-white/5 pointer-events-none"></div>
            <div className="absolute top-[-50px] left-1/2 -translate-x-1/2 w-[60%] h-[100px] bg-primary/40 blur-[80px] pointer-events-none rounded-[100%]"></div>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/3 h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent shadow-[0_0_20px_2px_rgba(99,102,241,0.6)]"></div>

            {/* Modal Header */}
            <div className="flex justify-between items-start p-8 pb-4 relative z-20">
              <div>
                <h2 className="text-xl font-medium text-[#EEEEEE] relative z-10">{editingId ? 'Editar cliente' : 'Novo cliente'}</h2>
                <p className="text-[#6e6e6e] text-xs mt-1 font-light">Gerencie as informações contratuais e estratégicas.</p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-gray-500 hover:text-white rounded-lg hover:bg-white/10 transition-colors z-20"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex flex-1 overflow-hidden relative z-10">
              {/* Sidebar Tabs */}
              <div className="w-64 border-r border-white/5 p-4 space-y-1 overflow-y-auto">
                {[
                  { id: 'dados', icon: User, label: 'Dados Gerais' },
                  { id: 'financeiro', icon: DollarSign, label: 'Financeiro' },
                  { id: 'escopo', icon: Briefcase, label: 'Escopo' },
                  { id: 'equipe', icon: Users, label: 'Equipe' },
                  { id: 'estrategia', icon: Target, label: 'Estratégia' },
                  { id: 'historico', icon: History, label: 'Histórico', disabled: !editingId }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => !tab.disabled && setActiveTab(tab.id)}
                    disabled={tab.disabled}
                    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all text-sm font-light ${activeTab === tab.id
                      ? 'bg-purple-500/10 text-purple-300 border border-purple-500/20'
                      : tab.disabled ? 'opacity-40 cursor-not-allowed text-gray-600' : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                      }`}
                  >
                    <tab.icon size={16} className={activeTab === tab.id ? 'text-purple-400' : ''} />
                    <span>{tab.label}</span>
                  </button>
                ))}
              </div>

              {/* Content Area */}
              <div className="flex-1 p-8 overflow-y-auto custom-scrollbar">
                {/* 1. ABA DADOS */}
                {activeTab === 'dados' && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="grid grid-cols-2 gap-5">
                      <div className="col-span-2 group">
                        <label className="block text-[11px] font-medium text-[#6e6e6e] tracking-tight ml-1">Nome do Cliente</label>
                        <input
                          type="text"
                          className="w-full bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] rounded-xl px-4 py-3 text-white/90 placeholder-[#6e6e6e] focus:bg-white/[0.08] focus:border-purple-500/30 focus:ring-0 outline-none transition-all duration-300 text-sm font-light"
                          value={formData.name}
                          onChange={e => setFormData({ ...formData, name: e.target.value })}
                          placeholder="Nome da Empresa ou Pessoa"
                        />
                      </div>
                      <div className="group">
                        <label className="block text-[11px] font-medium text-[#6e6e6e] tracking-tight ml-1">Email</label>
                        <input
                          type="email"
                          className="w-full bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] rounded-xl px-4 py-3 text-white/90 placeholder-[#6e6e6e] focus:bg-white/[0.08] focus:border-purple-500/30 focus:ring-0 outline-none transition-all duration-300 text-sm font-light"
                          value={formData.email}
                          onChange={e => setFormData({ ...formData, email: e.target.value })}
                          placeholder="contato@cliente.com"
                        />
                      </div>
                      <div className="group">
                        <label className="block text-[11px] font-medium text-[#6e6e6e] tracking-tight ml-1">Telefone</label>
                        <IMaskInput
                          mask="(00) 00000-0000"
                          className="w-full bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] rounded-xl px-4 py-3 text-white/90 placeholder-[#6e6e6e] focus:bg-white/[0.08] focus:border-purple-500/30 focus:ring-0 outline-none transition-all duration-300 text-sm font-light"
                          value={formData.phone}
                          onAccept={(val: string) => setFormData({ ...formData, phone: val })}
                          placeholder="(00) 00000-0000"
                        />
                      </div>
                      <div className="group">
                        <label className="block text-[11px] font-medium text-[#6e6e6e] tracking-tight ml-1">Website</label>
                        <input
                          type="text"
                          className="w-full bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] rounded-xl px-4 py-3 text-white/90 placeholder-[#6e6e6e] focus:bg-white/[0.08] focus:border-purple-500/30 focus:ring-0 outline-none transition-all duration-300 text-sm font-light"
                          value={formData.website}
                          onChange={e => setFormData({ ...formData, website: e.target.value })}
                          placeholder="www.site.com"
                        />
                      </div>
                      <div className="group">
                        <label className="block text-[11px] font-medium text-[#6e6e6e] tracking-tight ml-1">Instagram</label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <span className="text-gray-500 font-light">@</span>
                          </div>
                          <input
                            type="text"
                            className="w-full bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] rounded-xl pl-8 pr-4 py-3 text-white/90 placeholder-gray-600 focus:bg-white/[0.08] focus:border-purple-500/30 focus:ring-0 outline-none transition-all duration-300 text-sm font-light"
                            value={formData.instagram.replace('@', '')}
                            onChange={e => setFormData({ ...formData, instagram: e.target.value.replace('@', '') })}
                            placeholder="usuario"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="group">
                          <label className="block text-[11px] font-medium text-[#6e6e6e] tracking-tight ml-1">Data de Início</label>
                          <input
                            type="date"
                            className="w-full bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] rounded-xl px-4 py-3 text-white/90 focus:bg-white/[0.08] focus:border-purple-500/30 focus:ring-0 outline-none transition-all duration-300 text-sm font-light [color-scheme:dark]"
                            value={formData.start_date || ''}
                            onChange={e => setFormData({ ...formData, start_date: e.target.value })}
                          />
                        </div>
                        <div className="group">
                          <label className="block text-[11px] font-medium text-[#6e6e6e] tracking-tight ml-1">Data de Encerramento</label>
                          <input
                            type="date"
                            className="w-full bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] rounded-xl px-4 py-3 text-white/90 focus:bg-white/[0.08] focus:border-purple-500/30 focus:ring-0 outline-none transition-all duration-300 text-sm font-light [color-scheme:dark]"
                            value={formData.end_date || ''}
                            onChange={e => setFormData({ ...formData, end_date: e.target.value })}
                          />
                        </div>
                      </div>
                      <div className="col-span-2 group">
                        <label className="block text-[11px] font-medium text-[#6e6e6e] tracking-tight ml-1">Briefing</label>
                        <textarea
                          className="w-full bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] rounded-xl px-4 py-3 text-white/90 placeholder-gray-600 focus:bg-white/[0.08] focus:border-purple-500/30 focus:ring-0 outline-none transition-all duration-300 text-sm font-light h-32 resize-none"
                          value={formData.briefing}
                          onChange={e => setFormData({ ...formData, briefing: e.target.value })}
                          placeholder="Histórico da empresa, contexto, etc."
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. ABA FINANCEIRO */}
                {activeTab === 'financeiro' && (
                  <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div>
                      <label className="block text-[11px] font-medium text-[#6e6e6e] tracking-tight ml-1">Status do Contrato</label>
                      <div className="relative group">
                        <select
                          value={formData.status}
                          onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                          className="w-full bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] rounded-xl px-4 py-3 text-white/90 focus:bg-white/[0.08] focus:border-primary/30 focus:ring-0 outline-none appearance-none cursor-pointer transition-all duration-300 text-sm font-light"
                        >
                          <option value="active" className="bg-[#0a0a1a]">Ativo</option>
                          <option value="paused" className="bg-[#0a0a1a]">Pausado</option>
                          <option value="canceled" className="bg-[#0a0a1a]">Cancelado</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                      <div className="group">
                        <label className="block text-[11px] font-medium text-[#6e6e6e] tracking-tight ml-1">Mensalidade (MRR)</label>
                        <div className="relative">
                          <span className="absolute left-4 top-3.5 text-gray-500 text-sm font-light">R$</span>
                          <input
                            type="number"
                            className="w-full bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] rounded-xl pl-10 pr-4 py-3 text-white/90 focus:bg-white/[0.08] focus:border-purple-500/30 focus:ring-0 outline-none transition-all duration-300 text-sm font-light"
                            value={formData.mrr}
                            onChange={e => setFormData({ ...formData, mrr: parseFloat(e.target.value) })}
                          />
                        </div>
                      </div>
                      <div className="group">
                        <label className="block text-[11px] font-medium text-[#6e6e6e] tracking-tight ml-1">Dia de Vencimento</label>
                        <select
                          className="w-full bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] rounded-xl px-4 py-3 text-white/90 focus:bg-white/[0.08] focus:border-purple-500/30 focus:ring-0 outline-none transition-all duration-300 text-sm font-light appearance-none cursor-pointer"
                          value={formData.due_day}
                          onChange={e => setFormData({ ...formData, due_day: parseInt(e.target.value) })}
                        >
                          {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                            <option key={d} value={d} className="bg-[#0a0a1a]">Dia {d}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-lg hover:bg-white/[0.02] transition-colors group cursor-pointer border border-transparent hover:border-white/5" onClick={() => setFormData({ ...formData, payment_reminder: !formData.payment_reminder })}>
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${formData.payment_reminder ? 'bg-primary/20 text-primary' : 'bg-white/5 text-gray-500'}`}>
                          <DollarSign size={16} />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-200">Lembrete Automático</span>
                          <span className="text-[10px] text-gray-500">Enviar cobrança por email/whatsapp</span>
                        </div>
                      </div>
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${formData.payment_reminder ? 'border-primary bg-primary' : 'border-white/20 bg-transparent'}`}>
                        {formData.payment_reminder && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. ABA ESCOPO */}
                {activeTab === 'escopo' && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide ml-1">Serviços Contratados</label>
                      <div className="flex gap-2 mb-3">
                        <input
                          type="text"
                          className="flex-1 bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-2.5 text-white/90 placeholder-gray-600 focus:border-purple-500/30 outline-none text-sm font-light"
                          placeholder="Adicionar serviço personalizado..."
                          value={newService}
                          onChange={e => setNewService(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleAddCustomItem('service')}
                        />
                        <button onClick={() => handleAddCustomItem('service')} className="bg-white/10 hover:bg-white/20 px-4 rounded-xl text-white transition-colors">
                          <Plus size={18} />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-3 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                        {allServices.map(service => (
                          <div
                            key={service}
                            onClick={() => toggleArrayItem('services', service)}
                            className={`p-3 rounded-xl border cursor-pointer flex items-center justify-between transition-all group ${formData.services?.includes(service)
                              ? 'bg-purple-500/10 border-purple-500/30'
                              : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.05]'
                              }`}
                          >
                            <span className={`text-sm font-light ${formData.services?.includes(service) ? 'text-purple-200' : 'text-gray-400 group-hover:text-gray-200'}`}>{service}</span>
                            <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${formData.services?.includes(service) ? 'border-purple-500 bg-purple-500' : 'border-white/10 bg-transparent'}`}>
                              {formData.services?.includes(service) && <div className="w-2 h-2 bg-white rounded-full"></div>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide ml-1">Escopo Detalhado</label>
                      <textarea
                        className="w-full bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] rounded-xl px-4 py-3 text-white/90 placeholder-gray-600 focus:bg-white/[0.08] focus:border-purple-500/30 focus:ring-0 outline-none transition-all duration-300 text-sm font-mono h-48 resize-none leading-relaxed"
                        value={formData.scope_description}
                        onChange={e => setFormData({ ...formData, scope_description: e.target.value })}
                        placeholder="Descreva detalhadamente o que será entregue..."
                      />
                    </div>
                  </div>
                )}

                {/* 4. ABA EQUIPE */}
                {activeTab === 'equipe' && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                    <label className="block text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide ml-1">Responsáveis pelo Cliente</label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {companyMembers.map(member => (
                        <div
                          key={member.id}
                          onClick={() => toggleArrayItem('team_members', member.id)}
                          className={`flex items-center space-x-4 p-4 rounded-xl border cursor-pointer transition-all group ${formData.team_members?.includes(member.id)
                            ? 'bg-purple-500/10 border-purple-500/30 shadow-[0_0_15px_-5px_rgba(168,85,247,0.15)]'
                            : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.05]'
                            }`}
                        >
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shadow-inner ${formData.team_members?.includes(member.id) ? 'bg-purple-600 text-white' : 'bg-white/5 text-gray-500'
                            }`}>
                            {member.name.charAt(0)}
                          </div>
                          <div className="flex-1">
                            <div className={`font-medium text-sm ${formData.team_members?.includes(member.id) ? 'text-white' : 'text-gray-400 group-hover:text-gray-200'}`}>
                              {member.name}
                            </div>
                            <div className="text-[10px] text-gray-600">Membro da Equipe</div>
                          </div>
                          <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${formData.team_members?.includes(member.id) ? 'border-purple-500 bg-purple-500' : 'border-white/10 bg-transparent'}`}>
                            {formData.team_members?.includes(member.id) && <div className="w-2 h-2 bg-white rounded-full"></div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 5. ABA ESTRATÉGIA (Cofre) */}
                {activeTab === 'estrategia' && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide ml-1">Objetivos Estratégicos</label>
                      <div className="flex gap-2 mb-3">
                        <input
                          type="text"
                          className="flex-1 bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-2.5 text-white/90 placeholder-gray-600 focus:border-purple-500/30 outline-none text-sm font-light"
                          placeholder="Novo objetivo..."
                          value={newGoal}
                          onChange={e => setNewGoal(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleAddCustomItem('goal')}
                        />
                        <button onClick={() => handleAddCustomItem('goal')} className="bg-white/10 hover:bg-white/20 px-4 rounded-xl text-white transition-colors">
                          <Plus size={18} />
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {allGoals.map(goal => (
                          <button
                            key={goal}
                            onClick={() => toggleArrayItem('strategic_goals', goal)}
                            className={`px-4 py-2 rounded-full text-xs font-medium border transition-all ${formData.strategic_goals?.includes(goal)
                              ? 'bg-purple-500/20 border-purple-500/40 text-purple-300'
                              : 'bg-white/5 border-white/10 text-gray-500 hover:bg-white/10 hover:text-gray-300'
                              }`}
                          >
                            {goal}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="border-t border-white/5 pt-6">
                      <div className="flex justify-between items-center mb-4">
                        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide flex items-center gap-2">
                          <Lock size={12} className="text-purple-400" />
                          Cofre de Credenciais
                        </label>
                      </div>

                      {!editingId ? (
                        <div className="bg-yellow-500/5 border border-yellow-500/10 p-4 rounded-xl text-yellow-500/60 text-xs font-light text-center">
                          Salve o cliente primeiro para adicionar credenciais com segurança.
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {/* New Credential Form */}
                          <div className="bg-white/[0.02] p-4 rounded-xl border border-white/5 space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                              <input type="text" className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white/90 text-xs focus:border-purple-500/30 outline-none" placeholder="Serviço (ex: Facebook Ads)" value={newCredential.service_name} onChange={e => setNewCredential({ ...newCredential, service_name: e.target.value })} />
                              <input type="text" className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white/90 text-xs focus:border-purple-500/30 outline-none" placeholder="Login / Email" value={newCredential.login} onChange={e => setNewCredential({ ...newCredential, login: e.target.value })} />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <input type="password" className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white/90 text-xs focus:border-purple-500/30 outline-none" placeholder="Senha" value={newCredential.password} onChange={e => setNewCredential({ ...newCredential, password: e.target.value })} />
                              <input type="text" className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white/90 text-xs focus:border-purple-500/30 outline-none" placeholder="Obs (opcional)" value={newCredential.notes} onChange={e => setNewCredential({ ...newCredential, notes: e.target.value })} />
                            </div>
                            <button onClick={handleAddCredential} className="w-full bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 text-xs font-medium py-2.5 rounded-lg transition-all border border-purple-500/10 hover:border-purple-500/30">
                              + Adicionar Credencial
                            </button>
                          </div>

                          {/* Credentials List */}
                          <div className="space-y-2">
                            {credentials.map(cred => (
                              <div key={cred.id} className="flex items-center justify-between p-3 bg-white/[0.02] rounded-xl border border-white/5 hover:bg-white/[0.04] transition-colors group">
                                <div>
                                  <div className="text-gray-200 font-medium text-xs">{cred.service_name}</div>
                                  <div className="text-[10px] text-gray-600">{cred.login}</div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="relative">
                                    <input
                                      type={showPassword[cred.id] ? "text" : "password"}
                                      value={cred.password || '********'}
                                      readOnly
                                      className="bg-transparent border-none text-right text-xs text-gray-500 w-24 focus:ring-0 cursor-default"
                                    />
                                  </div>
                                  <button onClick={() => setShowPassword(prev => ({ ...prev, [cred.id]: !prev[cred.id] }))} className="p-1.5 hover:bg-white/10 rounded text-gray-500 hover:text-white transition-colors">
                                    {showPassword[cred.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                                  </button>
                                  <button onClick={() => {
                                    navigator.clipboard.writeText(cred.password || '');
                                    toast.success('Copiado', 'Senha copiada para a área de transferência!');
                                  }} className="p-1.5 hover:bg-white/10 rounded text-gray-500 hover:text-white transition-colors">
                                    <Copy size={14} />
                                  </button>
                                  <button onClick={() => handleDeleteCredential(cred.id)} className="p-1.5 hover:bg-red-500/10 rounded text-gray-500 hover:text-red-400 transition-colors">
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 6. ABA HISTÓRICO (Logs Reais) */}
                {activeTab === 'historico' && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="space-y-4">
                      {logs.length === 0 ? (
                        <div className="text-center text-gray-600 py-8 text-sm font-light">Nenhum histórico registrado.</div>
                      ) : (
                        logs.map(log => (
                          <div key={log.id} className="flex items-start space-x-4 pb-4 border-b border-white/5 last:border-0">
                            <div className="mt-1">
                              {log.new_status === 'active' ? <CheckCircle size={16} className="text-green-500" /> :
                                log.new_status === 'paused' ? <AlertCircle size={16} className="text-yellow-500" /> :
                                  <X size={16} className="text-red-500" />}
                            </div>
                            <div>
                              <div className="text-gray-300 text-sm">
                                Status alterado de <span className="font-bold text-gray-500">{log.previous_status}</span> para <span className="font-bold text-white">{log.new_status}</span>
                              </div>
                              <div className="text-[10px] text-gray-600 mt-1">
                                {new Date(log.changed_at).toLocaleString()} por {log.user_name}
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 flex justify-end space-x-3 relative z-20">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-6 py-3 text-sm text-gray-500 hover:text-white transition-colors hover:bg-white/5 rounded-xl font-light"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={loading}
                className="px-8 py-3 bg-white/[0.05] hover:bg-white/[0.1] text-white rounded-xl border border-white/5 hover:border-white/20 transition-all duration-300 font-medium text-sm flex items-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span>{loading ? 'Salvando...' : 'Salvar Alterações'}</span>
                <span className="text-primary group-hover:translate-x-1 transition-transform">→</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Utility Styles
const labelStyle = "block text-sm font-medium text-gray-400 mb-2 uppercase tracking-wide text-xs";
const inputStyle = "w-full bg-black/20 border border-white/10 rounded-lg p-3 text-white focus:ring-2 focus:ring-primary outline-none transition-all placeholder-gray-600 focus:bg-black/40";

export default Clientes;
