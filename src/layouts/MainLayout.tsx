import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  ChevronDown,
  ChevronRight,
  X
} from 'lucide-react';
import {
  IconLayoutDashboard,
  IconSubtask,
  IconRobot,
  IconCalendar,
  IconCurrencyDollar,
  IconSettings,
  IconBuilding,
  IconFileDescription,
  IconUsers,
  IconCpu,
  IconUserCheck,
  IconMenu2,
  IconBell,
  IconSearch,
  IconLogout,
  IconArrowLeft,
  IconChartPie,
  IconReceipt,
  IconList,
  IconClock,
  IconChecks,
  IconLayoutSidebarLeftCollapse,
  IconArrowsMaximize,
  IconLayoutGrid,
  IconColumns,
  IconUser,
  IconLayoutKanban
} from '@tabler/icons-react';
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
  const [layoutMode, setLayoutMode] = useState<'normal' | 'no-header' | 'zen'>('normal');
  const [flyoutMenu, setFlyoutMenu] = useState<string | null>(null);

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
    setFlyoutMenu(null);
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
      {layoutMode !== 'zen' && (
        <aside
          className={`relative z-20 flex flex-col transition-all duration-300 ${sidebarOpen ? 'w-64' : 'w-20'
            } glass-card border-r border-white/10 bg-[#0a0a1a]/80 backdrop-blur-md`}
        >
          {/* Logo Area */}
          <div className="flex items-center justify-center h-20 border-b border-white/10 relative">
            <h1 className={`text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent transition-all duration-300 ${!sidebarOpen && 'scale-0 w-0'
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
                <IconArrowLeft size={20} />
              </button>
            )}
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-2 scrollbar-thin scrollbar-thumb-white/10">
            <NavItem to="/atividades" icon={<IconLayoutDashboard />} label="Atividades" expanded={sidebarOpen} />

            {/* Organizador with Submenu */}
            <div className="relative">
              <button
                onClick={() => {
                  if (sidebarOpen) { toggleOrganizador(); }
                  else { setFlyoutMenu(flyoutMenu === 'organizador' ? null : 'organizador'); }
                }}
                className={`w-full flex items-center ${sidebarOpen ? 'justify-between' : 'justify-center'} p-3 rounded-lg transition-colors hover:bg-white/5 ${location.pathname.includes('/organizador') ? 'text-primary bg-white/5' : 'text-gray-400'
                  }`}
              >
                <div className={`flex items-center ${sidebarOpen ? 'space-x-3' : ''}`}>
                  <IconSubtask className={`w-5 h-5 ${location.pathname.includes('/organizador') ? 'text-primary glow-icon' : ''}`} />
                  {sidebarOpen && <span>Organizador</span>}
                </div>
                {sidebarOpen && (
                  organizadorOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />
                )}
              </button>

              {/* Submenu - expanded sidebar */}
              <div className={`overflow-hidden transition-all duration-300 ${organizadorOpen && sidebarOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                }`}>
                <div className="ml-4 mt-2 space-y-1 border-l border-white/10 pl-2">
                  <SubNavItem to="/organizador/kanban" icon={<IconLayoutKanban size={16} />} label="Kanban" />
                  <SubNavItem to="/organizador/lista" icon={<IconList size={16} />} label="Lista" />
                  <SubNavItem to="/organizador/historico" icon={<IconChecks size={16} />} label="Histórico" />
                  <SubNavItem to="/organizador/cronograma" icon={<IconClock size={16} />} label="Cronograma" />
                </div>
              </div>

              {/* Flyout - collapsed sidebar */}
              {!sidebarOpen && flyoutMenu === 'organizador' && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setFlyoutMenu(null)}></div>
                  <div className="absolute left-full top-0 ml-2 w-52 bg-[#161635]/95 backdrop-blur-md border border-white/10 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.7)] z-40 p-2 animate-in fade-in slide-in-from-left-2 duration-200">
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider px-3 py-2">Organizador</p>
                    <SubNavItem to="/organizador/kanban" icon={<IconLayoutKanban size={16} />} label="Kanban" />
                    <SubNavItem to="/organizador/lista" icon={<IconList size={16} />} label="Lista" />
                    <SubNavItem to="/organizador/historico" icon={<IconChecks size={16} />} label="Histórico" />
                    <SubNavItem to="/organizador/cronograma" icon={<IconClock size={16} />} label="Cronograma" />
                  </div>
                </>
              )}
            </div>

            <NavItem to="/relatorios" icon={<IconRobot />} label="Relatórios IA e Agente" expanded={sidebarOpen} />
            <NavItem to="/calendario" icon={<IconCalendar />} label="Calendário" expanded={sidebarOpen} />

            {/* Financeiro with Submenu */}
            <div className="relative">
              <button
                onClick={() => {
                  if (sidebarOpen) { toggleFinanceiro(); }
                  else { setFlyoutMenu(flyoutMenu === 'financeiro' ? null : 'financeiro'); }
                }}
                className={`w-full flex items-center ${sidebarOpen ? 'justify-between' : 'justify-center'} p-3 rounded-lg transition-colors hover:bg-white/5 ${location.pathname.includes('/financeiro') ? 'text-primary bg-white/5' : 'text-gray-400'
                  }`}
              >
                <div className={`flex items-center ${sidebarOpen ? 'space-x-3' : ''}`}>
                  <IconCurrencyDollar className={`w-5 h-5 ${location.pathname.includes('/financeiro') ? 'text-primary glow-icon' : ''}`} />
                  {sidebarOpen && <span>Financeiro</span>}
                </div>
                {sidebarOpen && (
                  financeiroOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />
                )}
              </button>

              {/* Submenu - expanded sidebar */}
              <div className={`overflow-hidden transition-all duration-300 ${financeiroOpen && sidebarOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                }`}>
                <div className="ml-4 mt-2 space-y-1 border-l border-white/10 pl-2">
                  <SubNavItem to="/financeiro/visao-geral" icon={<IconChartPie size={16} />} label="Visão Geral" />
                  <SubNavItem to="/financeiro/lancamentos" icon={<IconReceipt size={16} />} label="Lançamentos" />
                  <SubNavItem to="/financeiro/comissoes" icon={<IconUsers size={16} />} label="Comissões e Sócios" />
                  <SubNavItem to="/financeiro/cobranca" icon={<IconSettings size={16} />} label="Cobrança" />
                </div>
              </div>

              {/* Flyout - collapsed sidebar */}
              {!sidebarOpen && flyoutMenu === 'financeiro' && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setFlyoutMenu(null)}></div>
                  <div className="absolute left-full top-0 ml-2 w-52 bg-[#161635]/95 backdrop-blur-md border border-white/10 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.7)] z-40 p-2 animate-in fade-in slide-in-from-left-2 duration-200">
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider px-3 py-2">Financeiro</p>
                    <SubNavItem to="/financeiro/visao-geral" icon={<IconChartPie size={16} />} label="Visão Geral" />
                    <SubNavItem to="/financeiro/lancamentos" icon={<IconReceipt size={16} />} label="Lançamentos" />
                    <SubNavItem to="/financeiro/comissoes" icon={<IconUsers size={16} />} label="Comissões e Sócios" />
                    <SubNavItem to="/financeiro/cobranca" icon={<IconSettings size={16} />} label="Cobrança" />
                  </div>
                </>
              )}
            </div>

            {/* Configuração with Submenu */}
            <div className="relative">
              <button
                onClick={() => {
                  if (sidebarOpen) { toggleConfig(); }
                  else { setFlyoutMenu(flyoutMenu === 'config' ? null : 'config'); }
                }}
                className={`w-full flex items-center ${sidebarOpen ? 'justify-between' : 'justify-center'} p-3 rounded-lg transition-colors hover:bg-white/5 ${location.pathname.includes('/configuracao') ? 'text-primary bg-white/5' : 'text-gray-400'
                  }`}
              >
                <div className={`flex items-center ${sidebarOpen ? 'space-x-3' : ''}`}>
                  <IconSettings className={`w-5 h-5 ${location.pathname.includes('/configuracao') ? 'text-primary glow-icon' : ''}`} />
                  {sidebarOpen && <span>Configuração</span>}
                </div>
                {sidebarOpen && (
                  configOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />
                )}
              </button>

              {/* Submenu - expanded sidebar */}
              <div className={`overflow-hidden transition-all duration-300 ${configOpen && sidebarOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                }`}>
                <div className="ml-4 mt-2 space-y-1 border-l border-white/10 pl-2">
                  <SubNavItem to="/configuracao/empresa" icon={<IconBuilding size={16} />} label="Empresa" />
                  <SubNavItem to="/configuracao/regras-financeiras" icon={<IconFileDescription size={16} />} label="Regras Financeiras" />
                  <SubNavItem to="/configuracao/clientes" icon={<IconUsers size={16} />} label="Gestão de Clientes" />
                  <SubNavItem to="/configuracao/ia-automacao" icon={<IconCpu size={16} />} label="IA e Automação" />
                  <SubNavItem to="/configuracao/equipe" icon={<IconUserCheck size={16} />} label="Equipe" />
                  <SubNavItem to="/configuracao/kanban" icon={<IconColumns size={16} />} label="Kanban" />
                </div>
              </div>

              {/* Flyout - collapsed sidebar */}
              {!sidebarOpen && flyoutMenu === 'config' && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setFlyoutMenu(null)}></div>
                  <div className="absolute left-full top-0 ml-2 w-52 bg-[#161635]/95 backdrop-blur-md border border-white/10 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.7)] z-40 p-2 animate-in fade-in slide-in-from-left-2 duration-200">
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider px-3 py-2">Configuração</p>
                    <SubNavItem to="/configuracao/empresa" icon={<IconBuilding size={16} />} label="Empresa" />
                    <SubNavItem to="/configuracao/regras-financeiras" icon={<IconFileDescription size={16} />} label="Regras Financeiras" />
                    <SubNavItem to="/configuracao/clientes" icon={<IconUsers size={16} />} label="Gestão de Clientes" />
                    <SubNavItem to="/configuracao/ia-automacao" icon={<IconCpu size={16} />} label="IA e Automação" />
                    <SubNavItem to="/configuracao/equipe" icon={<IconUserCheck size={16} />} label="Equipe" />
                    <SubNavItem to="/configuracao/kanban" icon={<IconColumns size={16} />} label="Kanban" />
                  </div>
                </>
              )}
            </div>
          </nav>
        </aside>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col relative z-10 overflow-hidden">
        {/* Header */}
        {layoutMode === 'normal' && (
          <header className="h-20 glass-card border-b border-white/10 flex items-center justify-between px-8 bg-[#0a0a1a]/50 backdrop-blur-md relative z-50">
            <div className="flex items-center space-x-4">
              <button onClick={toggleSidebar} className="text-gray-400 hover:text-white transition-colors">
                <IconMenu2 size={24} />
              </button>
              <div className="relative hidden md:block">
                <IconSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-4 h-4" />
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
                  <IconBell size={20} />
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
                              <IconBell size={20} className="text-gray-600" />
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
                      <p className="text-xs text-gray-400 truncate mb-1">{user?.email}</p>
                      {selectedCompany && (
                        <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">{selectedCompany.name}</p>
                      )}
                      {user?.role === 'SUPER ADMIN' && selectedCompany && (
                        <div className="mt-2 p-2 rounded bg-primary/10 border border-primary/20">
                          <p className="text-[10px] text-primary uppercase font-bold">Gerenciando</p>
                          <p className="text-xs text-white truncate">{selectedCompany.name}</p>
                        </div>
                      )}
                    </div>

                    <div className="p-4 border-b border-white/10">
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-3">Layout</p>
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          onClick={() => { setLayoutMode('normal'); setSidebarOpen(true); }}
                          className={`flex flex-col items-center justify-center p-2 rounded-lg border transition-all ${layoutMode === 'normal' ? 'bg-primary/10 border-primary/50 text-primary' : 'bg-white/5 border-white/10 text-gray-400 hover:border-primary/50 hover:text-white'}`}
                          title="Header + Sidebar"
                        >
                          <IconLayoutGrid size={18} />
                        </button>
                        <button
                          onClick={() => { setLayoutMode('no-header'); setSidebarOpen(true); }}
                          className={`flex flex-col items-center justify-center p-2 rounded-lg border transition-all ${layoutMode === 'no-header' ? 'bg-primary/10 border-primary/50 text-primary' : 'bg-white/5 border-white/10 text-gray-400 hover:border-primary/50 hover:text-white'}`}
                          title="Sem Header"
                        >
                          <IconLayoutSidebarLeftCollapse size={18} />
                        </button>
                        <button
                          onClick={() => { setLayoutMode('zen'); setUserMenuOpen(false); }}
                          className={`flex flex-col items-center justify-center p-2 rounded-lg border transition-all ${layoutMode === 'zen' ? 'bg-primary/10 border-primary/50 text-primary' : 'bg-white/5 border-white/10 text-gray-400 hover:border-primary/50 hover:text-white'}`}
                          title="Modo Zen"
                        >
                          <IconArrowsMaximize size={18} />
                        </button>
                      </div>
                    </div>

                    {/* Action Menu */}
                    <div className="p-2">
                      <button
                        onClick={() => openUserSettings('profile')}
                        className="w-full flex items-center space-x-3 p-3 rounded-lg text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors"
                      >
                        <IconUser size={18} className="text-gray-500" />
                        <span>Meu Perfil</span>
                      </button>

                      <button
                        onClick={() => openUserSettings('settings')}
                        className="w-full flex items-center space-x-3 p-3 rounded-lg text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors"
                      >
                        <IconSettings size={18} className="text-gray-500" />
                        <span>Configurações</span>
                      </button>

                      <button
                        onClick={() => openUserSettings('preferences')}
                        className="w-full flex items-center justify-between p-3 rounded-lg text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors"
                      >
                        <div className="flex items-center space-x-3">
                          <IconBell size={18} className="text-gray-500" />
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
                        <IconLogout size={18} />
                        <span>Sair</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </header>
        )}

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

      {/* Floating Restore Button */}
      {layoutMode !== 'normal' && (
        <button
          onClick={() => { setLayoutMode('normal'); setSidebarOpen(true); }}
          className="fixed bottom-6 right-6 z-[100] w-12 h-12 rounded-full bg-primary/80 hover:bg-primary text-white flex items-center justify-center shadow-lg shadow-primary/30 backdrop-blur-sm border border-white/10 hover:scale-110 transition-all duration-300 group"
          title="Restaurar layout padrão"
        >
          <IconLayoutGrid size={20} />
          <span className="absolute right-full mr-3 bg-[#161635]/95 text-white text-xs px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap border border-white/10">Restaurar layout</span>
        </button>
      )}
    </div>
  );
};

const NavItem = ({ to, icon, label, expanded }: { to: string, icon: React.ReactNode, label: string, expanded: boolean }) => {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center space-x-3 p-3 rounded-lg transition-all duration-200 ${isActive
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
        `flex items-center space-x-3 p-2 rounded-lg text-sm transition-all duration-200 ${isActive
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
