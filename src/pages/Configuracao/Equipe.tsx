import React, { useState, useEffect } from 'react';
import { UserPlus, CheckCircle2, XCircle, Edit, X } from 'lucide-react';
import { useCompany } from '../../context/CompanyContext';
import { supabase } from '../../lib/supabase';
import { IMaskInput } from 'react-imask';
import { useUI } from '../../context/UIContext';
import { useAuth } from '../../context/AuthContext';

interface Member {
  id: string;
  user_id: string;
  role: 'admin' | 'editor' | 'visualizador';
  is_approver: boolean;
  status: 'active' | 'inactive' | 'invited';
  permissions?: Record<string, boolean>;
  profiles: {
    full_name: string;
    email: string;
    avatar_url?: string;
    whatsapp?: string;
  };
}

const ALL_PERMS = [
  'atividades', 'kanban', 'lista', 'historico_tarefas', 'cronograma',
  'inteligencia_artificial', 'calendario', 'financeiro_geral',
  'financeiro_lancamentos', 'financeiro_comissoes', 'financeiro_cobranca',
  'config_empresa', 'config_regras', 'config_clientes', 'config_ia',
  'config_equipe', 'suporte'
] as const;

const DEFAULT_PERMISSIONS = ALL_PERMS.reduce((acc, perm) => ({ ...acc, [perm]: true }), {});

const Equipe = () => {
  const { toast } = useUI();
  const { user } = useAuth();
  const { selectedCompany } = useCompany();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    whatsapp: '',
    role: 'visualizador',
    is_approver: false,
    status: true, // true = active, false = inactive
    permissions: { ...DEFAULT_PERMISSIONS } as any
  });

  useEffect(() => {
    if (selectedCompany) {
      fetchMembers();
    }
  }, [selectedCompany]);

  useEffect(() => {
    const handleGlobalNewMember = () => {
      setEditingMember(null);
      setFormData({
        name: '',
        email: '',
        password: '',
        whatsapp: '',
        role: 'visualizador',
        is_approver: false,
        status: true,
        permissions: { ...DEFAULT_PERMISSIONS } as any
      });
      setIsModalOpen(true);
    };

    window.addEventListener('open-new-member', handleGlobalNewMember);
    return () => window.removeEventListener('open-new-member', handleGlobalNewMember);
  }, []);

  const fetchMembers = async () => {
    try {
      if (!selectedCompany) return;

      const { data, error } = await supabase
        .from('organization_members')
        .select(`
          id,
          user_id,
          role,
          is_approver,
          status,
          permissions
        `)
        .eq('company_id', selectedCompany.id);

      if (error) throw error;

      if (data) {
        // Since we can't join with profiles yet due to schema cache issues or RLS,
        // we'll fetch profiles separately for now to unblock the UI.
        const userIds = data.map(m => m.user_id);
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, full_name, email, avatar_url, whatsapp')
          .in('id', userIds);

        const membersWithProfiles = data.map(m => {
          const profile = profilesData?.find(p => p.id === m.user_id);
          return {
            ...m,
            profiles: profile || { full_name: 'Desconhecido', email: '' }
          };
        });

        setMembers(membersWithProfiles as any);
      }
    } catch (error) {
      console.error('Error fetching members:', error);
    }
  };

  const handleEdit = (member: Member) => {
    setEditingMember(member);
    setFormData({
      name: member.profiles?.full_name || '',
      email: member.profiles?.email || '',
      password: '',
      whatsapp: member.profiles?.whatsapp || '',
      role: member.role,
      is_approver: member.is_approver,
      status: member.status === 'active',
      permissions: {
        ...DEFAULT_PERMISSIONS,
        ...(member.permissions || {})
      } as any
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingMember(null);
    setFormData({
      name: '',
      email: '',
      password: '',
      whatsapp: '',
      role: 'visualizador',
      is_approver: false,
      status: true,
      permissions: { ...DEFAULT_PERMISSIONS } as any
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (editingMember) {
        // Edit Mode - Update permissions in organization_members
        const { error } = await supabase
          .from('organization_members')
          .update({
            role: formData.role,
            is_approver: formData.is_approver,
            status: formData.status ? 'active' : 'inactive',
            permissions: formData.permissions
          })
          .eq('id', editingMember.id);

        if (error) throw error;

        // Update profile information (whatsapp, name, email)
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            full_name: formData.name,
            whatsapp: formData.whatsapp,
            email: formData.email
          })
          .eq('id', editingMember.user_id);

        if (profileError) throw profileError;

        toast.success('Membro atualizado com sucesso!');
      } else {
        // Create Mode (Invite)
        // NOTE: Creating a user with a specific password requires the Supabase Admin API
        // We will use the Edge Function 'create-user' that you have deployed.

        const { data: userData, error: userError } = await supabase.functions.invoke('create-user', {
          body: {
            email: formData.email,
            password: formData.password,
            name: formData.name,
            whatsapp: formData.whatsapp,
            company_id: selectedCompany?.id,
            role: formData.role,
            is_approver: formData.is_approver,
            status: formData.status ? 'active' : 'inactive',
            permissions: formData.permissions
          }
        });

        if (userError) throw userError;
        toast.success('Usuário convidado com sucesso!');
      }

      closeModal();
      fetchMembers(); // Refresh list
    } catch (error) {
      console.error('Error saving member:', error);
      toast.error('Erro ao salvar membro.');
    } finally {
      setLoading(false);
    }
  };

  if (!selectedCompany) return <div className="text-white">Selecione uma empresa.</div>;

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex-1"></div>
      </div>

      <div className="glass-card rounded-2xl border border-white/10 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-white/5 text-[#6e6e6e] text-[13px] tracking-wide">
              <th className="px-6 py-4 font-medium">Membro</th>
              <th className="px-6 py-4 font-medium">Perfil</th>
              <th className="px-6 py-4 font-medium">Aprovador</th>
              <th className="px-6 py-4 font-medium text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {members.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                  Nenhum membro encontrado.
                </td>
              </tr>
            ) : (
              members.map((member) => (
                <tr key={member.id} className="hover:bg-white/5 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center text-primary font-bold border border-primary/20 relative overflow-hidden">
                        {member.profiles?.avatar_url ? (
                          <img
                            src={member.profiles.avatar_url}
                            alt={member.profiles.full_name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          member.profiles?.full_name?.charAt(0) || '?'
                        )}
                        <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#0f0f1a] ${member.status === 'active' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                      </div>
                      <div>
                        <div className="text-white font-medium">{member.profiles?.full_name || 'Sem nome'}</div>
                        <div className="text-gray-500 text-xs">{member.profiles?.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-300 capitalize">{member.role}</td>
                  <td className="px-6 py-4">
                    {member.is_approver ? (
                      <CheckCircle2 size={18} className="text-green-500" />
                    ) : (
                      <XCircle size={18} className="text-gray-600" />
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleEdit(member)}
                      className="p-2 text-gray-500 hover:text-primary hover:bg-primary/10 rounded-lg transition-all"
                      title="Editar Membro"
                    >
                      <Edit size={18} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Adicionar Membro */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* 1. Overlay (Fundo Escuro com Blur e Noise) */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-md z-0 animate-in fade-in duration-300"
            onClick={closeModal}
          >
            <div className="absolute inset-0 opacity-[0.03] bg-[url('https://grainy-gradients.vercel.app/noise.svg')]"></div>
          </div>

          {/* 2. Container do Modal (Glass Card Premium) */}
          <div className="relative z-10 w-full max-w-lg rounded-[22px] overflow-hidden shadow-[0_32px_64px_-12px_rgba(0,0,0,0.6)] animate-in zoom-in-95 duration-300 border border-white/10 bg-[#0a0a1a]/10 backdrop-blur-xl ring-1 ring-white/10 ring-inset">

            {/* Grain Texture Overlay */}
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')] z-0"></div>

            {/* Borda interna sutil (Inner Border) */}
            <div className="absolute inset-0 rounded-[22px] border border-white/5 pointer-events-none"></div>

            {/* 3. Glow Roxo no Topo (Mais fiel à referência) */}
            <div className="absolute top-[-50px] left-1/2 -translate-x-1/2 w-[120%] h-[150px] bg-primary/30 blur-[80px] pointer-events-none rounded-[100%]"></div>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/3 h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent shadow-[0_0_20px_2px_rgba(99,102,241,0.6)]"></div>

            {/* Header Minimalista */}
            <div className="relative p-8 pb-2">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-medium text-[#EEEEEE] relative z-10">
                    {editingMember ? 'Editar Membro' : 'Novo membro'}
                  </h2>
                  <p className="text-[#6e6e6e] text-xs mt-1 font-light">Gerencie o acesso e permissões da equipe.</p>
                </div>
                <button
                  onClick={closeModal}
                  className="p-1.5 text-gray-500 hover:text-white rounded-lg hover:bg-white/10 transition-colors z-20"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-8 pt-4 space-y-5">
              <div className="space-y-4">
                {/* Input Search-like para Nome */}
                <div className="relative group">
                  <label className="text-[11px] tracking-wide font-medium text-[#6e6e6e] ml-1 mb-1 block">Nome completo</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] rounded-xl px-4 py-3 text-white/90 placeholder-[#6e6e6e] focus:bg-white/[0.08] focus:border-primary/30 focus:ring-0 focus:shadow-[0_0_15px_-3px_rgba(99,102,241,0.15)] outline-none transition-all duration-300 text-sm font-light"
                    placeholder="Nome do membro"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="relative group">
                    <label className="text-[11px] tracking-wide font-medium text-[#6e6e6e] ml-1 mb-1 block">E-mail</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={e => setFormData({ ...formData, email: e.target.value })}
                      className="w-full bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] rounded-xl px-4 py-3 text-white/90 placeholder-gray-500 focus:bg-white/[0.08] focus:border-primary/30 focus:ring-0 focus:shadow-[0_0_15px_-3px_rgba(99,102,241,0.15)] outline-none transition-all duration-300 text-sm font-light disabled:opacity-40"
                      placeholder="Email corporativo"
                      required
                      disabled={!!editingMember && !(user?.is_super_admin || user?.role === 'admin')}
                    />
                  </div>
                  <div className="relative group">
                    <label className="text-[11px] tracking-wide font-medium text-[#6e6e6e] ml-1 mb-1 block">WhatsApp</label>
                    <IMaskInput
                      mask="(00) 00000-0000"
                      type="tel"
                      value={formData.whatsapp}
                      onAccept={(value: string) => setFormData(prev => ({ ...prev, whatsapp: value }))}
                      className="w-full bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] rounded-xl px-4 py-3 text-white/90 placeholder-[#6e6e6e] focus:bg-white/[0.08] focus:border-primary/30 focus:ring-0 focus:shadow-[0_0_15px_-3px_rgba(99,102,241,0.15)] outline-none transition-all duration-300 text-sm font-light"
                      placeholder="(00) 00000-0000"
                    />
                  </div>
                </div>

                {!editingMember && (
                  <div className="relative group">
                    <label className="text-[11px] tracking-wide font-medium text-[#6e6e6e] ml-1 mb-1 block">Senha de acesso</label>
                    <input
                      type="password"
                      value={formData.password}
                      onChange={e => setFormData({ ...formData, password: e.target.value })}
                      className="w-full bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] rounded-xl px-4 py-3 text-white/90 placeholder-[#6e6e6e] focus:bg-white/[0.08] focus:border-primary/30 focus:ring-0 focus:shadow-[0_0_15px_-3px_rgba(99,102,241,0.15)] outline-none transition-all duration-300 text-sm font-light"
                      placeholder="Defina uma senha"
                      required
                    />
                  </div>
                )}

                <div className="relative group">
                  <label className="text-[11px] tracking-wide font-medium text-[#6e6e6e] ml-1 mb-1 block">Perfil de acesso</label>
                  <select
                    value={formData.role}
                    onChange={e => setFormData({ ...formData, role: e.target.value as any })}
                    className="w-full bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] rounded-xl px-4 py-3 text-white/90 focus:bg-white/[0.08] focus:border-primary/30 focus:ring-0 outline-none appearance-none cursor-pointer transition-all duration-300 text-sm font-light"
                  >
                    <option value="admin" className="bg-[#0a0a1a]">Admin</option>
                    <option value="editor" className="bg-[#0a0a1a]">Editor</option>
                    <option value="visualizador" className="bg-[#0a0a1a]">Visualizador</option>
                  </select>
                </div>
              </div>

              {/* Permissões Detalhadas */}
              <div className="space-y-4">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-[11px] tracking-wide font-bold text-gray-400 uppercase">Permissões detalhadas</h3>
                  <button
                    type="button"
                    onClick={() => {
                      const permissions = formData.permissions as Record<string, boolean>;
                      const allOn = ALL_PERMS.every(k => permissions[k]);
                      const newPerms = { ...permissions };
                      ALL_PERMS.forEach(k => {
                        newPerms[k] = !allOn;
                      });
                      setFormData({ ...formData, permissions: newPerms });
                    }}
                    className="text-[10px] text-primary hover:text-white transition-colors"
                  >
                    {ALL_PERMS.every(k => (formData.permissions as any)[k]) ? 'Desmarcar todas' : 'Marcar todas'}
                  </button>
                </div>

                <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-4 gap-x-2">
                    {[
                      { id: 'atividades', label: 'Dashboard' },
                      { id: 'kanban', label: 'Kanban' },
                      { id: 'lista', label: 'Lista' },
                      { id: 'historico_tarefas', label: 'Histórico' },
                      { id: 'cronograma', label: 'Cronograma' },
                      { id: 'inteligencia_artificial', label: 'Nexum Intelligence' },
                      { id: 'calendario', label: 'Calendário' },
                      { id: 'financeiro_geral', label: 'Financeiro (Geral)' },
                      { id: 'financeiro_lancamentos', label: 'Financeiro (Lanc.)' },
                      { id: 'financeiro_comissoes', label: 'Comissões/Sócios' },
                      { id: 'financeiro_cobranca', label: 'Cobrança' },
                      { id: 'config_empresa', label: 'Empresa' },
                      { id: 'config_regras', label: 'Regras Fin.' },
                      { id: 'config_clientes', label: 'Clientes' },
                      { id: 'config_ia', label: 'Config. IA' },
                      { id: 'config_equipe', label: 'Equipe' },
                      { id: 'suporte', label: 'Suporte' },
                    ].map((perm) => {
                      const permId = perm.id as keyof typeof formData.permissions;
                      return (
                        <div
                          key={perm.id}
                          onClick={() => setFormData({
                            ...formData,
                            permissions: {
                              ...formData.permissions,
                              [permId]: !formData.permissions[permId]
                            }
                          })}
                          className="flex items-center gap-2 cursor-pointer group"
                        >
                          <div className={`
                            w-4 h-4 rounded border flex items-center justify-center transition-all duration-200
                            ${formData.permissions[permId]
                              ? 'bg-primary border-primary shadow-[0_0_8px_rgba(99,102,241,0.4)]'
                              : 'border-white/20 bg-white/5 group-hover:border-white/40'}
                          `}>
                            {formData.permissions[permId] && <CheckCircle2 size={10} className="text-white" />}
                          </div>
                          <span className={`text-[11px] transition-colors ${formData.permissions[permId] ? 'text-white' : 'text-gray-500 group-hover:text-gray-300'}`}>
                            {perm.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Switches em Lista (Reference Style) */}
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div className="flex items-center justify-between p-3 rounded-lg hover:bg-white/[0.02] transition-colors group cursor-pointer" onClick={() => setFormData({ ...formData, is_approver: !formData.is_approver })}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${formData.is_approver ? 'bg-primary/20 text-primary' : 'bg-white/5 text-gray-500'}`}>
                      <CheckCircle2 size={16} />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-[#EEEEEE]">Aprovador</span>
                      <span className="text-[10px] text-[#6e6e6e]">Pode aprovar</span>
                    </div>
                  </div>
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${formData.is_approver ? 'border-primary bg-primary' : 'border-white/20 bg-transparent'}`}>
                    {formData.is_approver && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg hover:bg-white/[0.02] transition-colors group cursor-pointer" onClick={() => setFormData({ ...formData, status: !formData.status })}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${formData.status ? 'bg-green-500/20 text-green-400' : 'bg-white/5 text-gray-500'}`}>
                      <UserPlus size={16} />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-[#EEEEEE]">Status ativo</span>
                      <span className="text-[10px] text-[#6e6e6e]">Com acesso</span>
                    </div>
                  </div>
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${formData.status ? 'border-green-500 bg-green-500' : 'border-white/20 bg-transparent'}`}>
                    {formData.status && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
                  </div>
                </div>
              </div>

              {/* Ações (Quick Actions Style) */}
              <div className="pt-4 border-t border-white/5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-6 py-2.5 bg-transparent text-gray-500 hover:text-red-500 transition-all duration-300 font-medium text-sm flex items-center justify-center"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-8 py-2.5 bg-primary hover:bg-secondary text-white rounded-xl shadow-lg shadow-primary/20 transition-all duration-300 font-medium text-sm flex items-center justify-center"
                >
                  {loading ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Equipe;
