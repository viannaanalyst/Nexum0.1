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
      alert('Preencha os campos obrigatórios da credencial.');
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
      alert('Credencial adicionada com segurança!');
    } catch (error: any) {
      console.error('Error adding credential:', error);
      alert('Erro ao adicionar credencial: ' + error.message);
    }
  };

  const handleDeleteCredential = async (id: string) => {
    if (!confirm('Tem certeza que deseja remover esta credencial?')) return;
    try {
      const { error } = await supabase.rpc('delete_client_credential', { p_credential_id: id });
      if (error) throw error;
      setCredentials(prev => prev.filter(c => c.id !== id));
    } catch (error) {
      console.error('Error deleting credential:', error);
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
             alert('Cliente criado! Agora você pode adicionar credenciais.');
         } else {
             alert('Cliente salvo com sucesso!');
             setIsModalOpen(false);
         }
      }
      fetchClients();
    } catch (error: any) {
      console.error('Error saving client:', error);
      alert('Erro ao salvar cliente: ' + error.message);
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
        <div>
          <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400">
            Gestão de Clientes
          </h1>
          <p className="text-gray-400 mt-2">Gerencie seus clientes, contratos e estratégias.</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="flex items-center space-x-2 bg-primary hover:bg-secondary text-white px-6 py-3 rounded-lg shadow-lg shadow-primary/20 transition-all duration-300 transform hover:scale-105"
        >
          <Plus size={20} />
          <span>Novo Cliente</span>
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
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                      client.status === 'active' ? 'bg-green-500/20 text-green-400' :
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-5xl h-[90vh] flex flex-col rounded-2xl border border-white/10 overflow-hidden relative bg-[#0a0a1a]">
            {/* Modal Header */}
            <div className="flex justify-between items-center p-6 border-b border-white/10">
              <h2 className="text-2xl font-bold text-white">{editingId ? 'Editar Cliente' : 'Novo Cliente'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white"><X size={24} /></button>
            </div>

            {/* Modal Body */}
            <div className="flex flex-1 overflow-hidden">
              {/* Sidebar Tabs */}
              <div className="w-64 bg-black/20 border-r border-white/10 p-4 space-y-2 overflow-y-auto">
                {[
                  { id: 'dados', icon: User, label: 'Dados' },
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
                    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all text-sm font-medium ${
                      activeTab === tab.id 
                        ? 'bg-primary/20 text-primary border border-primary/20' 
                        : tab.disabled ? 'opacity-50 cursor-not-allowed text-gray-600' : 'text-gray-400 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <tab.icon size={18} />
                    <span>{tab.label}</span>
                  </button>
                ))}
              </div>

              {/* Content Area */}
              <div className="flex-1 p-8 overflow-y-auto bg-black/10">
                {/* 1. ABA DADOS */}
                {activeTab === 'dados' && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="grid grid-cols-2 gap-6">
                      <div className="col-span-2">
                        <label className="label">Nome do Cliente *</label>
                        <input type="text" className="input" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Nome da Empresa ou Pessoa" />
                      </div>
                      <div>
                        <label className="label">Email</label>
                        <input type="email" className="input" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="contato@cliente.com" />
                      </div>
                      <div>
                        <label className="label">Telefone / WhatsApp</label>
                        <IMaskInput mask="(00) 00000-0000" className="input" value={formData.phone} onAccept={(val: string) => setFormData({...formData, phone: val})} placeholder="(00) 00000-0000" />
                      </div>
                      <div>
                        <label className="label">Website</label>
                        <input type="text" className="input" value={formData.website} onChange={e => setFormData({...formData, website: e.target.value})} placeholder="www.site.com" />
                      </div>
                      <div>
                        <label className="label">Instagram</label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <span className="text-white font-bold text-lg">@</span>
                          </div>
                          <input 
                            type="text" 
                            className="input !pl-8" 
                            value={formData.instagram.replace('@', '')} 
                            onChange={e => setFormData({...formData, instagram: e.target.value.replace('@', '')})} 
                            placeholder="usuario" 
                          />
                        </div>
                      </div>
                      <div className="col-span-2">
                        <label className="label">Briefing / Observações</label>
                        <textarea className="input h-32 resize-none" value={formData.briefing} onChange={e => setFormData({...formData, briefing: e.target.value})} placeholder="Histórico da empresa, contexto, etc." />
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. ABA FINANCEIRO */}
                {activeTab === 'financeiro' && (
                  <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div>
                      <label className="label mb-4 block">Status do Cliente</label>
                      <div className="flex space-x-4">
                        {['active', 'paused', 'canceled'].map(status => (
                          <button
                            key={status}
                            onClick={() => setFormData({...formData, status: status as any})}
                            className={`flex-1 py-4 rounded-xl border-2 transition-all font-bold uppercase tracking-wider ${
                              formData.status === status
                                ? status === 'active' ? 'border-green-500 bg-green-500/10 text-green-400'
                                : status === 'paused' ? 'border-yellow-500 bg-yellow-500/10 text-yellow-400'
                                : 'border-red-500 bg-red-500/10 text-red-400'
                                : 'border-white/10 bg-white/5 text-gray-500 hover:bg-white/10'
                            }`}
                          >
                            {status === 'active' ? 'Ativo' : status === 'paused' ? 'Pausado' : 'Cancelado'}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <label className="label">MRR (Mensal)</label>
                        <div className="relative">
                          <span className="absolute left-3 top-3 text-gray-400">R$</span>
                          <input 
                            type="number" 
                            className="input pl-10" 
                            value={formData.mrr} 
                            onChange={e => setFormData({...formData, mrr: parseFloat(e.target.value)})} 
                          />
                        </div>
                      </div>
                      <div>
                        <label className="label">Dia de Vencimento</label>
                        <select className="input appearance-none" value={formData.due_day} onChange={e => setFormData({...formData, due_day: parseInt(e.target.value)})}>
                          {Array.from({length: 31}, (_, i) => i + 1).map(d => (
                            <option key={d} value={d}>Dia {d}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10">
                      <div>
                        <div className="text-white font-medium">Régua de Cobrança Automática</div>
                        <div className="text-sm text-gray-500">Enviar lembretes de pagamento por email/whatsapp</div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" checked={formData.payment_reminder} onChange={e => setFormData({...formData, payment_reminder: e.target.checked})} className="sr-only peer" />
                        <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                      </label>
                    </div>
                  </div>
                )}

                {/* 3. ABA ESCOPO */}
                {activeTab === 'escopo' && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div>
                      <label className="label">Serviços Contratados</label>
                      <div className="flex gap-2 mb-2">
                          <input 
                            type="text" 
                            className="input text-sm py-2" 
                            placeholder="Novo serviço..." 
                            value={newService} 
                            onChange={e => setNewService(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleAddCustomItem('service')}
                          />
                          <button onClick={() => handleAddCustomItem('service')} className="bg-white/10 hover:bg-white/20 px-3 rounded-lg text-white">
                            <Plus size={18} />
                          </button>
                      </div>
                      <div className="grid grid-cols-2 gap-3 mt-2 max-h-48 overflow-y-auto pr-2">
                        {allServices.map(service => (
                          <div 
                            key={service} 
                            onClick={() => toggleArrayItem('services', service)}
                            className={`p-3 rounded-lg border cursor-pointer flex items-center justify-between transition-all ${
                              formData.services?.includes(service) 
                                ? 'bg-primary/20 border-primary text-white' 
                                : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                            }`}
                          >
                            <span>{service}</span>
                            {formData.services?.includes(service) && <CheckCircle size={16} className="text-primary" />}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="label">Escopo Detalhado</label>
                      <textarea 
                        className="input h-64 resize-none font-mono text-sm leading-relaxed" 
                        value={formData.scope_description} 
                        onChange={e => setFormData({...formData, scope_description: e.target.value})} 
                        placeholder="Descreva detalhadamente o que será entregue..."
                      />
                    </div>
                  </div>
                )}

                {/* 4. ABA EQUIPE */}
                {activeTab === 'equipe' && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                    <label className="label">Membros Responsáveis</label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {companyMembers.map(member => (
                        <div 
                          key={member.id}
                          onClick={() => toggleArrayItem('team_members', member.id)}
                          className={`flex items-center space-x-4 p-4 rounded-xl border cursor-pointer transition-all ${
                            formData.team_members?.includes(member.id)
                              ? 'bg-primary/10 border-primary shadow-lg shadow-primary/5'
                              : 'bg-white/5 border-white/10 hover:bg-white/10'
                          }`}
                        >
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                            formData.team_members?.includes(member.id) ? 'bg-primary text-white' : 'bg-gray-700 text-gray-400'
                          }`}>
                            {member.name.charAt(0)}
                          </div>
                          <div className="flex-1">
                            <div className={`font-medium ${formData.team_members?.includes(member.id) ? 'text-white' : 'text-gray-300'}`}>
                              {member.name}
                            </div>
                            <div className="text-xs text-gray-500">Membro da Equipe</div>
                          </div>
                          {formData.team_members?.includes(member.id) && <CheckCircle className="text-primary" />}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 5. ABA ESTRATÉGIA (Cofre) */}
                {activeTab === 'estrategia' && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                     <div>
                      <label className="label">Objetivos Principais</label>
                      <div className="flex gap-2 mb-2">
                          <input 
                            type="text" 
                            className="input text-sm py-2" 
                            placeholder="Novo objetivo..." 
                            value={newGoal} 
                            onChange={e => setNewGoal(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleAddCustomItem('goal')}
                          />
                          <button onClick={() => handleAddCustomItem('goal')} className="bg-white/10 hover:bg-white/20 px-3 rounded-lg text-white">
                            <Plus size={18} />
                          </button>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {allGoals.map(goal => (
                          <button
                            key={goal}
                            onClick={() => toggleArrayItem('strategic_goals', goal)}
                            className={`px-4 py-2 rounded-full text-sm font-medium border transition-all ${
                              formData.strategic_goals?.includes(goal)
                                ? 'bg-accent/20 border-accent text-accent'
                                : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                            }`}
                          >
                            {goal}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="border-t border-white/10 pt-6">
                      <div className="flex justify-between items-center mb-4">
                        <label className="label mb-0 flex items-center gap-2">
                          <Lock size={14} className="text-primary" />
                          Cofre de Senhas e Credenciais
                        </label>
                      </div>
                      
                      {!editingId ? (
                        <div className="bg-yellow-500/10 border border-yellow-500/20 p-4 rounded-lg text-yellow-200 text-sm">
                          Salve o cliente primeiro para adicionar credenciais.
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {/* New Credential Form */}
                          <div className="bg-white/5 p-4 rounded-xl border border-white/10 space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                              <input type="text" className="input text-sm" placeholder="Serviço (ex: Facebook Ads)" value={newCredential.service_name} onChange={e => setNewCredential({...newCredential, service_name: e.target.value})} />
                              <input type="text" className="input text-sm" placeholder="Login / Email" value={newCredential.login} onChange={e => setNewCredential({...newCredential, login: e.target.value})} />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <input type="password" className="input text-sm" placeholder="Senha" value={newCredential.password} onChange={e => setNewCredential({...newCredential, password: e.target.value})} />
                              <input type="text" className="input text-sm" placeholder="Obs (opcional)" value={newCredential.notes} onChange={e => setNewCredential({...newCredential, notes: e.target.value})} />
                            </div>
                            <button onClick={handleAddCredential} className="w-full bg-white/10 hover:bg-white/20 text-white text-sm font-medium py-2 rounded-lg transition-colors">
                              + Adicionar Credencial Criptografada
                            </button>
                          </div>

                          {/* Credentials List */}
                          <div className="space-y-2">
                            {credentials.map(cred => (
                              <div key={cred.id} className="flex items-center justify-between p-3 bg-black/20 rounded-lg border border-white/5 group hover:border-white/10">
                                <div>
                                  <div className="text-white font-medium text-sm">{cred.service_name}</div>
                                  <div className="text-xs text-gray-500">{cred.login}</div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="relative">
                                    <input 
                                      type={showPassword[cred.id] ? "text" : "password"} 
                                      value={cred.password || '********'} 
                                      readOnly 
                                      className="bg-transparent border-none text-right text-sm text-gray-400 w-32 focus:ring-0"
                                    />
                                  </div>
                                  <button onClick={() => setShowPassword(prev => ({...prev, [cred.id]: !prev[cred.id]}))} className="p-1.5 hover:bg-white/10 rounded text-gray-400">
                                    {showPassword[cred.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                                  </button>
                                  <button onClick={() => {
                                    navigator.clipboard.writeText(cred.password || '');
                                    alert('Senha copiada!');
                                  }} className="p-1.5 hover:bg-white/10 rounded text-gray-400">
                                    <Copy size={14} />
                                  </button>
                                  <button onClick={() => handleDeleteCredential(cred.id)} className="p-1.5 hover:bg-red-500/20 rounded text-red-400">
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
                        <div className="text-center text-gray-500 py-4">Nenhum histórico registrado.</div>
                      ) : (
                        logs.map(log => (
                          <div key={log.id} className="flex items-start space-x-4 pb-4 border-b border-white/5 last:border-0">
                            <div className="mt-1">
                              {log.new_status === 'active' ? <CheckCircle size={16} className="text-green-500" /> :
                               log.new_status === 'paused' ? <AlertCircle size={16} className="text-yellow-500" /> :
                               <X size={16} className="text-red-500" />}
                            </div>
                            <div>
                              <div className="text-white text-sm">
                                Status alterado de <span className="font-bold text-gray-400">{log.previous_status}</span> para <span className="font-bold text-white">{log.new_status}</span>
                              </div>
                              <div className="text-xs text-gray-500 mt-1">
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
            <div className="p-6 border-t border-white/10 bg-black/40 flex justify-end space-x-4">
              <button onClick={() => setIsModalOpen(false)} className="px-6 py-3 text-gray-400 hover:text-white transition-colors">Cancelar</button>
              <button 
                onClick={handleSave} 
                disabled={loading}
                className="px-8 py-3 bg-primary hover:bg-secondary text-white rounded-lg shadow-lg shadow-primary/20 font-bold transition-all disabled:opacity-50"
              >
                {loading ? 'Salvando...' : 'Salvar Cliente'}
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
