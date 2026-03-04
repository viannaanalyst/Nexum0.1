import React, { useState, useEffect } from 'react';
import { UserPlus, CheckCircle2, XCircle, Edit } from 'lucide-react';
import { useCompany } from '../../context/CompanyContext';
import { supabase } from '../../lib/supabase';

interface Member {
  id: string;
  user_id: string;
  role: 'admin' | 'editor' | 'visualizador';
  is_approver: boolean;
  status: 'active' | 'inactive' | 'invited';
  profiles: {
    full_name: string;
    email: string;
  };
}

const Equipe = () => {
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
    status: true // true = active, false = inactive
  });

  useEffect(() => {
    if (selectedCompany) {
      fetchMembers();
    }
  }, [selectedCompany]);

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
          status
        `)
        .eq('company_id', selectedCompany.id);

      if (error) throw error;

      if (data) {
        // Since we can't join with profiles yet due to schema cache issues or RLS,
        // we'll fetch profiles separately for now to unblock the UI.
        const userIds = data.map(m => m.user_id);
        const { data: profilesData } = await supabase
            .from('profiles')
            .select('id, full_name, email')
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
        whatsapp: '',
        role: member.role,
        is_approver: member.is_approver,
        status: member.status === 'active'
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
        status: true
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
                status: formData.status ? 'active' : 'inactive'
            })
            .eq('id', editingMember.id);

          if (error) throw error;
          alert('Membro atualizado com sucesso!');
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
              status: formData.status ? 'active' : 'inactive'
            }
          });

          if (userError) throw userError;
          alert('Usuário convidado com sucesso!');
      }
      
      closeModal();
      fetchMembers(); // Refresh list
    } catch (error) {
      console.error('Error saving member:', error);
      alert('Erro ao salvar membro.');
    } finally {
      setLoading(false);
    }
  };

  if (!selectedCompany) return <div className="text-white">Selecione uma empresa.</div>;

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400">
            Gestão de Equipe
          </h1>
          <p className="text-gray-400 mt-2">Convide e gerencie os membros da {selectedCompany.name}.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center space-x-2 bg-primary hover:bg-secondary text-white px-6 py-3 rounded-lg shadow-lg shadow-primary/20 transition-all duration-300 transform hover:scale-105"
        >
          <UserPlus size={20} />
          <span>Adicionar Membro</span>
        </button>
      </div>

      <div className="glass-card rounded-2xl border border-white/10 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-white/5 text-gray-400 text-sm uppercase tracking-wider">
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
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center text-primary font-bold border border-primary/20 relative">
                        {member.profiles?.full_name?.charAt(0) || '?'}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-lg p-8 rounded-2xl border border-white/10 relative">
            <h2 className="text-2xl font-bold text-white mb-6">
                {editingMember ? 'Editar Membro' : 'Convidar Novo Membro'}
            </h2>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-400 mb-1">Nome Completo</label>
                  <input 
                    type="text" 
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-white focus:ring-2 focus:ring-primary outline-none disabled:opacity-50" 
                    placeholder="Ex: João Silva" 
                    required
                    disabled={!!editingMember} // Name editing restricted for now
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Email</label>
                  <input 
                    type="email" 
                    value={formData.email}
                    onChange={e => setFormData({...formData, email: e.target.value})}
                    className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-white focus:ring-2 focus:ring-primary outline-none disabled:opacity-50" 
                    placeholder="joao@email.com" 
                    required
                    disabled={!!editingMember} // Email editing restricted
                  />
                </div>

                {!editingMember && (
                    <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Senha Temporária</label>
                    <input 
                        type="password" 
                        value={formData.password}
                        onChange={e => setFormData({...formData, password: e.target.value})}
                        className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-white focus:ring-2 focus:ring-primary outline-none" 
                        placeholder="••••••••" 
                        required
                    />
                    </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">WhatsApp</label>
                  <input 
                    type="tel" 
                    value={formData.whatsapp}
                    onChange={e => setFormData({...formData, whatsapp: e.target.value})}
                    className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-white focus:ring-2 focus:ring-primary outline-none" 
                    placeholder="(00) 00000-0000" 
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Perfil (Role)</label>
                  <select 
                    value={formData.role}
                    onChange={e => setFormData({...formData, role: e.target.value as any})}
                    className="w-full bg-[#1a1a2e] border border-white/10 rounded-lg p-3 text-white focus:ring-2 focus:ring-primary outline-none appearance-none cursor-pointer"
                  >
                    <option value="admin">Admin</option>
                    <option value="editor">Editor</option>
                    <option value="visualizador">Visualizador</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 bg-white/5 p-4 rounded-xl border border-white/5 mt-4">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-white">É Aprovador?</span>
                      <span className="text-xs text-gray-500">Pode aprovar solicitações</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={formData.is_approver}
                        onChange={e => setFormData({...formData, is_approver: e.target.checked})}
                        className="sr-only peer" 
                      />
                      <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-white">Status</span>
                      <span className="text-xs text-gray-500">{formData.status ? 'Ativo (Acesso Liberado)' : 'Inativo (Bloqueado)'}</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={formData.status}
                        onChange={e => setFormData({...formData, status: e.target.checked})}
                        className="sr-only peer" 
                      />
                      <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                    </label>
                  </div>
              </div>

              <div className="flex space-x-4 mt-8 pt-4">
                <button type="button" onClick={closeModal} className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-colors">Cancelar</button>
                <button type="submit" disabled={loading} className="flex-1 py-3 bg-primary hover:bg-secondary text-white rounded-lg shadow-lg shadow-primary/20 transition-all font-bold">
                  {loading ? 'Salvando...' : (editingMember ? 'Salvar Alterações' : 'Enviar Convite')}
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
