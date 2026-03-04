import React, { useState, useEffect } from 'react';
import { 
  X, User, Mail, Shield, Lock, Save, Loader2, 
  Bell, Settings, UserCircle, ChevronRight, 
  Globe, Moon, Palette, LogOut, Eye, EyeOff 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

export type UserSettingsTab = 'profile' | 'settings' | 'preferences';

interface UserSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: UserSettingsTab;
}

const UserSettingsModal: React.FC<UserSettingsModalProps> = ({ isOpen, onClose, initialTab = 'profile' }) => {
  const { user, refreshUser, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<UserSettingsTab>(initialTab);
  const [name, setName] = useState(user?.name || '');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  
  // Password change states
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Preferences states
  const [notifications, setNotifications] = useState({
    email: true,
    browser: true,
    marketing: false,
    newTasks: true,
    dueDates: true,
    comments: true,
    statusChanges: false,
    approvals: true
  });

  useEffect(() => {
    if (user) {
      setName(user.name);
    }
    if (isOpen) {
      setActiveTab(initialTab);
      setMessage(null);
      
      // Load preferences from localStorage
      const savedNotifs = localStorage.getItem(`notifs_${user?.id}`);
      if (savedNotifs) setNotifications(JSON.parse(savedNotifs));
    }
  }, [user, isOpen, initialTab]);

  if (!isOpen) return null;

  const toggleNotification = (id: keyof typeof notifications) => {
    const newNotifs = { ...notifications, [id]: !notifications[id] };
    setNotifications(newNotifs);
    localStorage.setItem(`notifs_${user?.id}`, JSON.stringify(newNotifs));
    
    // Show a quick message
    setMessage({ type: 'success', text: 'Preferência de notificação atualizada!' });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleSavePreferences = () => {
    localStorage.setItem(`notifs_${user?.id}`, JSON.stringify(notifications));
    setMessage({ type: 'success', text: 'Preferências salvas com sucesso!' });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      setMessage(null);

      if (!e.target.files || e.target.files.length === 0) {
        throw new Error('Você deve selecionar uma imagem para fazer upload.');
      }

      const file = e.target.files[0];
      const fileExt = file.name.split('.').pop();
      const filePath = `${user?.id}/${Math.random()}.${fileExt}`;

      // 1. Upload the image to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('profiles')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // 2. Get the public URL
      const { data: { publicUrl } } = supabase.storage
        .from('profiles')
        .getPublicUrl(filePath);

      // 3. Update the profile with the new avatar_url
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user?.id);

      if (updateError) throw updateError;

      await refreshUser();
      setMessage({ type: 'success', text: 'Foto de perfil atualizada!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setUploading(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    setMessage(null);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: name })
        .eq('id', user.id);

      if (error) throw error;

      await refreshUser();
      setMessage({ type: 'success', text: 'Perfil atualizado com sucesso!' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Erro ao atualizar perfil' });
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'As senhas não coincidem' });
      return;
    }

    setPasswordLoading(true);
    setMessage(null);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      setMessage({ type: 'success', text: 'Senha alterada com sucesso!' });
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Erro ao alterar senha' });
    } finally {
      setPasswordLoading(false);
    }
  };

  const tabs = [
    { id: 'profile', label: 'Meu Perfil', icon: <UserCircle size={18} />, description: 'Suas informações pessoais' },
    { id: 'settings', label: 'Configurações', icon: <Settings size={18} />, description: 'Segurança e conta' },
    { id: 'preferences', label: 'Preferências', icon: <Bell size={18} />, description: 'Notificações e interface' },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md transition-all duration-300">
      <div className="relative w-full max-w-4xl h-[600px] flex glass-card border border-white/10 bg-[#0a0a1a]/95 shadow-[0_0_50px_rgba(0,0,0,0.5)] rounded-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Sidebar Navigation */}
        <div className="w-72 border-r border-white/5 bg-white/[0.02] flex flex-col p-6">
          <div className="mb-8">
            <h2 className="text-xl font-bold text-white mb-1">Ajustes</h2>
            <p className="text-xs text-gray-500">Gerencie sua conta e preferências</p>
          </div>

          <nav className="flex-1 space-y-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as UserSettingsTab)}
                className={`w-full flex items-center space-x-3 p-3 rounded-xl transition-all duration-200 group ${
                  activeTab === tab.id 
                    ? 'bg-primary/10 text-primary border border-primary/20 shadow-[0_0_15px_rgba(99,102,241,0.1)]' 
                    : 'text-gray-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                <div className={`${activeTab === tab.id ? 'text-primary' : 'text-gray-500 group-hover:text-gray-300'}`}>
                  {tab.icon}
                </div>
                <div className="text-left flex-1">
                  <p className="text-sm font-medium">{tab.label}</p>
                  <p className="text-[10px] text-gray-500 group-hover:text-gray-400">{tab.description}</p>
                </div>
                {activeTab === tab.id && <ChevronRight size={14} className="text-primary" />}
              </button>
            ))}
          </nav>

          <button 
            onClick={logout}
            className="flex items-center space-x-3 p-3 rounded-xl text-red-400 hover:bg-red-400/10 transition-colors mt-auto"
          >
            <LogOut size={18} />
            <span className="text-sm font-medium">Encerrar Sessão</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-white/5">
            <div>
              <h3 className="text-lg font-bold text-white">
                {tabs.find(t => t.id === activeTab)?.label}
              </h3>
            </div>
            <button 
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white transition-colors rounded-full hover:bg-white/5"
            >
              <X size={20} />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 p-8 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
            {message && (
              <div className={`mb-6 p-4 rounded-xl text-sm animate-in fade-in slide-in-from-top-2 ${
                message.type === 'success' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
              }`}>
                {message.text}
              </div>
            )}

            {activeTab === 'profile' && (
              <div className="max-w-xl space-y-8">
                {/* Avatar Section */}
                <div className="flex items-center space-x-6">
                  <div className="relative group">
                    <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white text-3xl font-bold shadow-2xl shadow-primary/20 overflow-hidden">
                      {user?.avatar_url ? (
                        <img src={user.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                      ) : (
                        user?.name.charAt(0) || 'A'
                      )}
                      {uploading && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                          <Loader2 className="w-8 h-8 text-white animate-spin" />
                        </div>
                      )}
                    </div>
                    <label className="absolute -bottom-2 -right-2 p-2 bg-[#1a1a2e] border border-white/10 rounded-xl text-gray-400 hover:text-white shadow-lg transition-all group-hover:scale-110 cursor-pointer">
                      <Palette size={14} />
                      <input 
                        type="file" 
                        className="hidden" 
                        accept="image/*" 
                        onChange={handleAvatarUpload}
                        disabled={uploading}
                      />
                    </label>
                  </div>
                  <div>
                    <h4 className="text-white font-medium mb-1">Foto do Perfil</h4>
                    <p className="text-xs text-gray-500 mb-3">Clique para alterar seu avatar personalizado</p>
                    <label className="text-xs font-bold text-primary hover:text-primary-hover transition-colors cursor-pointer">
                      {uploading ? 'ENVIANDO...' : 'ALTERAR IMAGEM'}
                      <input 
                        type="file" 
                        className="hidden" 
                        accept="image/*" 
                        onChange={handleAvatarUpload}
                        disabled={uploading}
                      />
                    </label>
                  </div>
                </div>

                <form onSubmit={handleUpdateProfile} className="space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Nome Completo</label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
                        <input
                          type="text"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all placeholder-gray-600"
                          placeholder="Ex: Gabriel Silva"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">E-mail</label>
                      <div className="relative opacity-50">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
                        <input
                          type="email"
                          value={user?.email || ''}
                          disabled
                          className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm text-white cursor-not-allowed"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 rounded-lg bg-primary/20 text-primary">
                        <Shield size={16} />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">Nível de Acesso</p>
                        <p className="text-xs text-gray-500">Seu papel atual no sistema</p>
                      </div>
                    </div>
                    <span className="px-3 py-1 rounded-full bg-primary/20 text-primary text-[10px] font-bold uppercase tracking-widest">{user?.role}</span>
                  </div>

                  <div className="pt-4">
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex items-center space-x-2 bg-primary hover:bg-primary-hover text-white px-8 py-3 rounded-xl font-bold text-sm transition-all shadow-xl shadow-primary/20 disabled:opacity-50"
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      <span>Salvar Perfil</span>
                    </button>
                  </div>
                </form>
              </div>
            )}

            {activeTab === 'settings' && (
              <div className="max-w-xl space-y-8">
                <section className="space-y-6">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="p-2 rounded-lg bg-primary/20 text-primary">
                      <Lock size={18} />
                    </div>
                    <div>
                      <h4 className="text-white font-medium">Segurança da Conta</h4>
                      <p className="text-xs text-gray-500">Gerencie sua senha e autenticação</p>
                    </div>
                  </div>

                  <form onSubmit={handleChangePassword} className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Nova Senha</label>
                      <div className="relative">
                        <input
                          type={showNewPassword ? "text" : "password"}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all pr-12"
                          placeholder="••••••••"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors p-1"
                        >
                          {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Confirmar Senha</label>
                      <div className="relative">
                        <input
                          type={showConfirmPassword ? "text" : "password"}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all pr-12"
                          placeholder="••••••••"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors p-1"
                        >
                          {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>

                    <div className="pt-2">
                      <button
                        type="submit"
                        disabled={passwordLoading || !newPassword}
                        className="flex items-center space-x-2 bg-white/5 hover:bg-white/10 text-white px-8 py-3 rounded-xl font-bold text-sm border border-white/10 transition-all disabled:opacity-50"
                      >
                        {passwordLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                        <span>Atualizar Senha</span>
                      </button>
                    </div>
                  </form>
                </section>
              </div>
            )}

            {activeTab === 'preferences' && (
              <div className="max-w-xl space-y-8">
                <section className="space-y-6">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="p-2 rounded-lg bg-primary/20 text-primary">
                      <Bell size={18} />
                    </div>
                    <div>
                      <h4 className="text-white font-medium">Notificações</h4>
                      <p className="text-xs text-gray-500">Escolha como você quer ser avisado pelo sistema</p>
                    </div>
                  </div>

                  <div className="space-y-6">
                    {/* Atividades e Tarefas */}
                    <div className="space-y-4">
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Atividades e Tarefas</p>
                      {[
                        { id: 'newTasks', label: 'Novas Tarefas', desc: 'Sempre que você for atribuído a uma nova tarefa' },
                        { id: 'dueDates', label: 'Prazos Próximos', desc: 'Alertas sobre tarefas que estão perto do vencimento' },
                        { id: 'comments', label: 'Novos Comentários', desc: 'Quando alguém comentar em uma tarefa que você participa' },
                        { id: 'statusChanges', label: 'Alteração de Status', desc: 'Quando o status de uma de suas tarefas for alterado' },
                        { id: 'approvals', label: 'Pendentes de Aprovação', desc: 'Alertas sobre tarefas que aguardam sua aprovação ou revisão' },
                      ].map(item => (
                        <div key={item.id} className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-all group">
                          <div>
                            <p className="text-sm font-medium text-white group-hover:text-primary transition-colors">{item.label}</p>
                            <p className="text-[10px] text-gray-500">{item.desc}</p>
                          </div>
                          <button 
                            onClick={() => toggleNotification(item.id as keyof typeof notifications)}
                            className={`w-12 h-6 rounded-full relative transition-all duration-300 shadow-inner ${notifications[item.id as keyof typeof notifications] ? 'bg-primary shadow-primary/20' : 'bg-white/10'}`}
                          >
                            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-lg transition-all duration-300 ${notifications[item.id as keyof typeof notifications] ? 'right-1' : 'left-1'}`}></div>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>

                <div className="pt-4">
                  <button
                    onClick={handleSavePreferences}
                    className="flex items-center space-x-2 bg-primary hover:bg-primary-hover text-white px-8 py-3 rounded-xl font-bold text-sm transition-all shadow-xl shadow-primary/20"
                  >
                    <Save className="w-4 h-4" />
                    <span>Salvar Preferências</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserSettingsModal;
