import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  FolderKanban, 
  Bot, 
  Calendar, 
  DollarSign, 
  Settings, 
  Building2, 
  FileText, 
  Users, 
  Cpu, 
  UserCheck,
  Menu,
  Bell,
  Search,
  ChevronDown,
  ChevronRight,
  LogOut,
  ArrowLeft,
  PieChart,
  Receipt,
  List,
  Clock,
  CheckSquare,
  Monitor,
  LayoutGrid,
  Columns,
  User as UserIcon
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCompany } from '../context/CompanyContext';
import { supabase } from '../lib/supabase';
import UserSettingsModal from '../components/UserSettingsModal';
import type { UserSettingsTab } from '../components/UserSettingsModal';
import NotificationsHistoryModal from '../components/NotificationsHistoryModal';

const MainLayout = () => {
  const { user, logout, refreshUser } = useAuth();
  const { selectedCompany, selectCompany } = useCompany();
  const location = useLocation();
  const navigate = useNavigate();
  
  // Initialize closed by default, allow useEffect to open based on route
  const [configOpen, setConfigOpen] = useState(false);
  const [financeiroOpen, setFinanceiroOpen] = useState(false);
  const [organizadorOpen, setOrganizadorOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [userSettingsOpen, setUserSettingsOpen] = useState(false);
  const [userSettingsTab, setUserSettingsTab] = useState<UserSettingsTab>('profile');
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsHistoryOpen, setNotificationsHistoryOpen] = useState(false);

  // Real notifications from database
  const [notifications, setNotifications] = useState<any[]>([]);

  useEffect(() => {
    if (user) {
      fetchNotifications();
    }
  }, [user]);

  const fetchNotifications = async () => {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotifications(data || []);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  const hasUnread = notifications.some(n => n.unread);

  const markAsRead = async (id: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ unread: false })
        .eq('id', id);

      if (error) throw error;
      setNotifications(notifications.map(n => n.id === id ? { ...n, unread: false } : n));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ unread: false })
        .eq('user_id', user?.id)
        .eq('unread', true);

      if (error) throw error;
      setNotifications(notifications.map(n => ({ ...n, unread: false })));
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setNotifications(notifications.filter(n => n.id !== id));
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const openUserSettings = (tab: UserSettingsTab) => {
    setUserSettingsTab(tab);
    setUserSettingsOpen(true);
    setUserMenuOpen(false);
  };

  // Auto-expand sidebar section based on current route
  React.useEffect(() => {
    if (location.pathname.includes('/configuracao')) setConfigOpen(true);
    if (location.pathname.includes('/financeiro')) setFinanceiroOpen(true);
    if (location.pathname.includes('/organizador')) setOrganizadorOpen(true);
  }, [location.pathname]);

  const toggleConfig = () => setConfigOpen(!configOpen);
  const toggleFinanceiro = () => setFinanceiroOpen(!financeiroOpen);
  const toggleOrganizador = () => setOrganizadorOpen(!organizadorOpen);
  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

  const handleBackToSuperAdmin = () => {
    selectCompany(''); // Clear selection
    navigate('/super-admin');
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#0a0a1a] text-white font-sans">
      {/* Background Layer */}
      <div 
        className="fixed inset-0 z-0 opacity-20 pointer-events-none"
        style={{
          backgroundImage: "url('https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1920&q=80')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      ></div>
      
      {/* Sidebar */}
      <aside 
        className={`relative z-20 flex flex-col transition-all duration-300 ${
          sidebarOpen ? 'w-64' : 'w-20'
        } glass-card border-r border-white/10 bg-[#0a0a1a]/80 backdrop-blur-md`}
      >
        {/* Logo Area */}
        <div className="flex items-center justify-center h-20 border-b border-white/10 relative">
          <h1 className={`text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent transition-all duration-300 ${
            !sidebarOpen && 'scale-0 w-0'
          }`}>
            Nexum
          </h1>
          {!sidebarOpen && <span className="text-2xl font-bold text-primary">N</span>}
          
          {user?.role === 'SUPER ADMIN' && sidebarOpen && (
             <button 
               onClick={handleBackToSuperAdmin}
               className="absolute left-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-white"
               title="Voltar para Super Admin"
             >
               <ArrowLeft size={20} />
             </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-2 scrollbar-thin scrollbar-thumb-white/10">
          <NavItem to="/atividades" icon={<LayoutDashboard />} label="Atividades" expanded={sidebarOpen} />
          
          {/* Organizador with Submenu */}
          <div>
            <button
              onClick={toggleOrganizador}
              className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors hover:bg-white/5 ${
                location.pathname.includes('/organizador') ? 'text-primary bg-white/5' : 'text-gray-400'
              }`}
            >
              <div className="flex items-center space-x-3">
                <FolderKanban className={`w-5 h-5 ${location.pathname.includes('/organizador') ? 'text-primary glow-icon' : ''}`} />
                {sidebarOpen && <span>Organizador</span>}
              </div>
              {sidebarOpen && (
                organizadorOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />
              )}
            </button>

            {/* Submenu */}
            <div className={`overflow-hidden transition-all duration-300 ${
              organizadorOpen && sidebarOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
            }`}>
              <div className="ml-4 mt-2 space-y-1 border-l border-white/10 pl-2">
                <SubNavItem to="/organizador/kanban" icon={<FolderKanban size={16} />} label="Kanban" />
                <SubNavItem to="/organizador/lista" icon={<List size={16} />} label="Lista" />
                <SubNavItem to="/organizador/historico" icon={<CheckSquare size={16} />} label="Histórico" />
                <SubNavItem to="/organizador/cronograma" icon={<Clock size={16} />} label="Cronograma" />
              </div>
            </div>
          </div>

          <NavItem to="/relatorios" icon={<Bot />} label="Relatórios IA e Agente" expanded={sidebarOpen} />
          <NavItem to="/calendario" icon={<Calendar />} label="Calendário" expanded={sidebarOpen} />
          
          {/* Financeiro with Submenu */}
          <div>
            <button
              onClick={toggleFinanceiro}
              className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors hover:bg-white/5 ${
                location.pathname.includes('/financeiro') ? 'text-primary bg-white/5' : 'text-gray-400'
              }`}
            >
              <div className="flex items-center space-x-3">
                <DollarSign className={`w-5 h-5 ${location.pathname.includes('/financeiro') ? 'text-primary glow-icon' : ''}`} />
                {sidebarOpen && <span>Financeiro</span>}
              </div>
              {sidebarOpen && (
                financeiroOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />
              )}
            </button>

            {/* Submenu */}
            <div className={`overflow-hidden transition-all duration-300 ${
              financeiroOpen && sidebarOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
            }`}>
              <div className="ml-4 mt-2 space-y-1 border-l border-white/10 pl-2">
                <SubNavItem to="/financeiro/visao-geral" icon={<PieChart size={16} />} label="Visão Geral" />
                <SubNavItem to="/financeiro/lancamentos" icon={<Receipt size={16} />} label="Lançamentos" />
                <SubNavItem to="/financeiro/comissoes" icon={<Users size={16} />} label="Comissões e Sócios" />
                <SubNavItem to="/financeiro/cobranca" icon={<Settings size={16} />} label="Cobrança" />
              </div>
            </div>
          </div>

          {/* Configuração with Submenu */}
          <div>
            <button
              onClick={toggleConfig}
              className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors hover:bg-white/5 ${
                location.pathname.includes('/configuracao') ? 'text-primary bg-white/5' : 'text-gray-400'
              }`}
            >
              <div className="flex items-center space-x-3">
                <Settings className={`w-5 h-5 ${location.pathname.includes('/configuracao') ? 'text-primary glow-icon' : ''}`} />
                {sidebarOpen && <span>Configuração</span>}
              </div>
              {sidebarOpen && (
                configOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />
              )}
            </button>

            {/* Submenu */}
            <div className={`overflow-hidden transition-all duration-300 ${
              configOpen && sidebarOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
            }`}>
              <div className="ml-4 mt-2 space-y-1 border-l border-white/10 pl-2">
                <SubNavItem to="/configuracao/empresa" icon={<Building2 size={16} />} label="Empresa" />
                <SubNavItem to="/configuracao/regras-financeiras" icon={<FileText size={16} />} label="Regras Financeiras" />
                <SubNavItem to="/configuracao/clientes" icon={<Users size={16} />} label="Gestão de Clientes" />
                <SubNavItem to="/configuracao/ia-automacao" icon={<Cpu size={16} />} label="IA e Automação" />
                <SubNavItem to="/configuracao/equipe" icon={<UserCheck size={16} />} label="Equipe" />
              </div>
            </div>
          </div>
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col relative z-10 overflow-hidden">
        {/* Header */}
        <header className="h-20 glass-card border-b border-white/10 flex items-center justify-between px-8 bg-[#0a0a1a]/50 backdrop-blur-md relative z-50">
          <div className="flex items-center space-x-4">
            <button onClick={toggleSidebar} className="text-gray-400 hover:text-white transition-colors">
              <Menu size={24} />
            </button>
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-4 h-4" />
              <input 
                type="text" 
                placeholder="Pesquisar..." 
                className="bg-white/5 border border-white/10 rounded-full py-2 pl-10 pr-4 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary w-64 placeholder-gray-500"
              />
            </div>
          </div>
          
          <div className="flex items-center space-x-6 relative">
            <div className="relative">
              <button 
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className="relative text-gray-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/5"
              >
                <Bell size={20} />
                {hasUnread && (
                  <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-[#0a0a1a] animate-pulse"></span>
                )}
              </button>

              {/* Notifications Dropdown */}
              {notificationsOpen && (
                <>
                  <div className="fixed inset-0 z-[60]" onClick={() => setNotificationsOpen(false)}></div>
                  <div className="absolute right-0 top-full mt-2 w-80 border border-white/10 bg-[#161635]/95 backdrop-blur-md shadow-[0_10px_40px_rgba(0,0,0,0.7)] z-[70] rounded-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
                      <h3 className="text-sm font-bold text-white">Notificações</h3>
                      {hasUnread && (
                        <button 
                          onClick={markAllAsRead}
                          className="text-[10px] font-bold text-primary hover:text-primary-hover transition-colors uppercase tracking-wider"
                        >
                          Ler todas
                        </button>
                      )}
                    </div>
                    
                    <div className="max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
                      {notifications.length > 0 ? (
                        <div className="divide-y divide-white/5">
                          {notifications.map((notification) => (
                            <div 
                              key={notification.id} 
                              onClick={() => markAsRead(notification.id)}
                              className={`p-4 hover:bg-white/5 transition-colors cursor-pointer group relative ${notification.unread ? 'bg-primary/5' : ''}`}
                            >
                              {notification.unread && (
                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary"></div>
                              )}
                              <div className="flex justify-between items-start mb-1">
                                <p className={`text-xs font-bold ${notification.unread ? 'text-white' : 'text-gray-300'}`}>
                                  {notification.title}
                                </p>
                                <span className="text-[10px] text-gray-500 whitespace-nowrap ml-2">
                                  {new Date(notification.created_at).toLocaleDateString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              <p className="text-[11px] text-gray-400 leading-relaxed line-clamp-2 group-hover:text-gray-300 transition-colors">
                                {notification.description}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-8 text-center">
                          <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-3">
                            <Bell size={20} className="text-gray-600" />
                          </div>
                          <p className="text-xs text-gray-500">Nenhuma notificação por aqui.</p>
                        </div>
                      )}
                    </div>
                    
                    <div className="p-3 border-t border-white/10 bg-white/[0.02] text-center">
                      <button 
                        onClick={() => {
                          setNotificationsHistoryOpen(true);
                          setNotificationsOpen(false);
                        }}
                        className="text-[10px] font-bold text-gray-400 hover:text-white transition-colors uppercase tracking-widest w-full py-1"
                      >
                        Ver todo o histórico
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
            
            {/* User Trigger */}
            <div className="flex items-center space-x-3">
              <div className="text-right hidden md:block cursor-pointer" onClick={() => setUserMenuOpen(!userMenuOpen)}>
                <p className="text-sm font-medium text-white hover:text-primary transition-colors">
                   Olá, {user?.name}!
                   <span className="block text-[10px] text-gray-400/60 uppercase tracking-widest font-bold">Nexum</span>
                   {user?.role === 'SUPER ADMIN' && selectedCompany && (
                     <span className="block text-xs text-primary">Gerenciando: {selectedCompany.name}</span>
                   )}
                </p>
                {!selectedCompany && <p className="text-xs text-gray-400 capitalize">{user?.role}</p>}
              </div>
              <button 
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold shadow-lg shadow-primary/30 shrink-0 hover:scale-105 transition-transform overflow-hidden"
              >
                {user?.avatar_url ? (
                  <img src={user.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  user?.name.charAt(0) || 'A'
                )}
              </button>
            </div>

            {/* User Dropdown Menu */}
            {userMenuOpen && (
              <>
                {/* Backdrop to close menu */}
                <div 
                  className="fixed inset-0 z-[60]" 
                  onClick={() => setUserMenuOpen(false)}
                ></div>
                
                <div className="absolute right-0 top-full mt-2 w-72 border border-white/10 bg-[#161635]/95 backdrop-blur-md shadow-[0_10px_40px_rgba(0,0,0,0.7)] z-[70] rounded-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                  {/* User Info Section */}
                  <div className="p-4 border-b border-white/10">
                    <p className="text-sm font-bold text-white truncate">{user?.name}</p>
                    <p className="text-xs text-gray-400 truncate mb-2">{user?.email}</p>
                    {user?.role === 'SUPER ADMIN' && selectedCompany && (
                      <div className="mt-2 p-2 rounded bg-primary/10 border border-primary/20">
                        <p className="text-[10px] text-primary uppercase font-bold">Gerenciando</p>
                        <p className="text-xs text-white truncate">{selectedCompany.name}</p>
                      </div>
                    )}
                  </div>

                  {/* Layout Section */}
                  <div className="p-4 border-b border-white/10">
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-3">Layout</p>
                    <div className="grid grid-cols-3 gap-2">
                      <button className="flex flex-col items-center justify-center p-2 rounded-lg bg-white/5 border border-white/10 hover:border-primary/50 text-gray-400 hover:text-white transition-all">
                        <LayoutGrid size={18} />
                      </button>
                      <button className="flex flex-col items-center justify-center p-2 rounded-lg bg-white/5 border border-white/10 hover:border-primary/50 text-gray-400 hover:text-white transition-all">
                        <Columns size={18} />
                      </button>
                      <button className="flex flex-col items-center justify-center p-2 rounded-lg bg-white/5 border border-white/10 hover:border-primary/50 text-gray-400 hover:text-white transition-all">
                        <Monitor size={18} />
                      </button>
                    </div>
                  </div>

                  {/* Action Menu */}
                  <div className="p-2">
                    <button 
                      onClick={() => openUserSettings('profile')}
                      className="w-full flex items-center space-x-3 p-3 rounded-lg text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors"
                    >
                      <UserIcon size={18} className="text-gray-500" />
                      <span>Meu Perfil</span>
                    </button>
                    
                    <button 
                      onClick={() => openUserSettings('settings')}
                      className="w-full flex items-center space-x-3 p-3 rounded-lg text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors"
                    >
                      <Settings size={18} className="text-gray-500" />
                      <span>Configurações</span>
                    </button>

                    <button 
                      onClick={() => openUserSettings('preferences')}
                      className="w-full flex items-center justify-between p-3 rounded-lg text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        <Bell size={18} className="text-gray-500" />
                        <div className="text-left">
                          <span>Preferências</span>
                          <p className="text-[10px] text-gray-500">Notificações</p>
                        </div>
                      </div>
                    </button>

                    <div className="my-1 border-t border-white/5"></div>

                    <button 
                      onClick={logout}
                      className="w-full flex items-center space-x-3 p-3 rounded-lg text-sm text-red-400 hover:bg-red-400/10 transition-colors"
                    >
                      <LogOut size={18} />
                      <span>Sair</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </header>

        {/* Content Scrollable Area */}
        <main className="flex-1 overflow-y-auto p-8 scrollbar-thin scrollbar-thumb-white/10">
          <Outlet />
        </main>
      </div>

      {/* Modals */}
      <UserSettingsModal 
        isOpen={userSettingsOpen} 
        onClose={() => setUserSettingsOpen(false)} 
        initialTab={userSettingsTab}
      />

      <NotificationsHistoryModal 
        isOpen={notificationsHistoryOpen}
        onClose={() => setNotificationsHistoryOpen(false)}
        notifications={notifications}
        onMarkAsRead={markAsRead}
        onMarkAllAsRead={markAllAsRead}
        onDelete={deleteNotification}
      />
    </div>
  );
};

const NavItem = ({ to, icon, label, expanded }: { to: string, icon: React.ReactNode, label: string, expanded: boolean }) => {
  return (
    <NavLink 
      to={to} 
      className={({ isActive }) => 
        `flex items-center space-x-3 p-3 rounded-lg transition-all duration-200 ${
          isActive 
            ? 'bg-primary/10 text-primary border-l-2 border-primary shadow-[0_0_15px_rgba(99,102,241,0.3)]' 
            : 'text-gray-400 hover:bg-white/5 hover:text-white'
        }`
      }
    >
      <span className={expanded ? "" : "mx-auto"}>
        {React.cloneElement(icon as any, { 
          className: `w-5 h-5 ${expanded ? '' : ''}` // Could add classes if active
        })}
      </span>
      {expanded && <span>{label}</span>}
    </NavLink>
  );
};

const SubNavItem = ({ to, icon, label }: { to: string, icon: React.ReactNode, label: string }) => {
  return (
    <NavLink 
      to={to} 
      className={({ isActive }) => 
        `flex items-center space-x-3 p-2 rounded-lg text-sm transition-all duration-200 ${
          isActive 
            ? 'text-primary font-medium bg-primary/5' 
            : 'text-gray-500 hover:text-gray-300'
        }`
      }
    >
      <span>{icon}</span>
      <span>{label}</span>
    </NavLink>
  );
};

export default MainLayout;
