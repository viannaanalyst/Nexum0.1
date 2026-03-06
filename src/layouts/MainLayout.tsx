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
  IconLayoutKanban,
  IconHelpCircle
} from '@tabler/icons-react';
import { useAuth } from '../context/AuthContext';
import { useCompany } from '../context/CompanyContext';
import { supabase } from '../lib/supabase';
import UserSettingsModal from '../components/UserSettingsModal';
import type { UserSettingsTab } from '../components/UserSettingsModal';
import NotificationsHistoryModal from '../components/NotificationsHistoryModal';
import { useUI } from '../context/UIContext';

const MainLayout = () => {
  const { user, logout, refreshUser } = useAuth();
  const { selectedCompany, selectCompany } = useCompany();
  const { toast } = useUI();
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
  const [flyoutY, setFlyoutY] = useState(0);

  // Real notifications from database
  const [notifications, setNotifications] = useState<any[]>([]);

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

  useEffect(() => {
    if (user) {
      fetchNotifications();

      // Realtime subscription for new notifications
      const channel = supabase
        .channel(`user-notifications-${user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*', // Listen to inserts, updates, deletes
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            // If it's a new notification, show a toast
            if (payload.eventType === 'INSERT') {
              const newNotif = payload.new as any;
              toast.info(newNotif.description, newNotif.title);
            }

            // Refresh notifications when anything changes
            fetchNotifications();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const unreadCount = notifications.filter(n => n.unread).length;
  const hasUnread = unreadCount > 0;

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
    <div className="flex flex-col h-screen overflow-hidden bg-[#0a0a1a] text-white font-sans">
      {/* Background Layer */}
      <div
        className="fixed inset-0 z-0 opacity-20 pointer-events-none"
        style={{
          backgroundImage: "url('https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1920&q=80')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      ></div>

      {/* Full-width Header */}
      {layoutMode === 'normal' && (
        <header className="h-[52px] glass-card border-b border-white/10 flex items-center justify-between px-6 bg-[#0a0a1a]/80 backdrop-blur-md relative z-50 shrink-0">
          <div className="flex items-center space-x-6">
            {/* Logo Area */}
            <div className="flex items-center space-x-3">
              <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">
                Nexum
              </h1>
              <button onClick={toggleSidebar} className="text-gray-400 hover:text-white transition-colors ml-2">
                <IconMenu2 size={24} />
              </button>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {/* Search Bar - Moved to the right */}
            <div className="relative hidden md:block">
              <IconSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-3.5 h-3.5" />
              <input
                type="text"
                placeholder="Pesquisar..."
                className="bg-white/[0.03] border border-white/10 rounded-full py-1.5 pl-9 pr-14 text-[11px] text-white focus:outline-none focus:ring-1 focus:ring-primary/50 w-36 placeholder-gray-600 transition-all focus:w-48 hover:bg-white/5"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center space-x-1 px-1.5 py-0.5 rounded border border-white/20 bg-white/10 pointer-events-none">
                <span className="text-[8px] font-black text-gray-400 uppercase tracking-tight">Ctrl</span>
                <span className="text-[9px] font-black text-white">K</span>
              </div>
            </div>

            {/* Notifications Button */}
            <div className="relative">
              <button
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className="relative text-gray-400 hover:text-white transition-all p-2 rounded-full border border-white/5 hover:bg-white/10 hover:border-white/20 w-[34px] h-[34px] flex items-center justify-center"
              >
                <IconBell size={18} stroke={1.5} />
                {hasUnread && (
                  <span className="absolute top-0 right-0 min-w-[16px] h-[16px] px-1 bg-red-500 rounded-full border border-[#0a0a1a] flex items-center justify-center text-[9px] font-bold text-white shadow-lg shadow-red-500/40 animate-pulse">
                    {unreadCount > 9 ? '+9' : unreadCount}
                  </span>
                )}
              </button>

              {/* Notifications Dropdown */}
              {notificationsOpen && (
                <>
                  <div className="fixed inset-0 z-[60]" onClick={() => setNotificationsOpen(false)}></div>
                  <div className="absolute right-0 top-full mt-2 w-[380px] border border-white/10 bg-[#0a0a1a]/90 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-[70] rounded-2xl overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300">

                    {/* Gradient Header */}
                    <div className="p-5 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-primary/10 to-transparent">
                      <div>
                        <h3 className="text-sm font-bold text-white mb-0.5">Notificações</h3>
                        <p className="text-[10px] text-gray-500 font-medium">Você tem {unreadCount} mensagens não lidas</p>
                      </div>
                      {hasUnread && (
                        <button
                          onClick={markAllAsRead}
                          className="px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-[10px] font-bold text-primary transition-all uppercase tracking-wider border border-primary/20"
                        >
                          Ler todas
                        </button>
                      )}
                    </div>

                    <div className="max-h-[450px] overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
                      {notifications.length > 0 ? (
                        <div className="divide-y divide-white/5">
                          {notifications.map((notification) => (
                            <div
                              key={notification.id}
                              onClick={() => markAsRead(notification.id)}
                              className={`p-5 hover:bg-white/[0.03] transition-all cursor-pointer group relative ${notification.unread ? 'bg-primary/5' : ''}`}
                            >
                              {notification.unread && (
                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary"></div>
                              )}
                              <div className="flex justify-between items-start mb-2">
                                <div className="flex items-center space-x-2">
                                  <div className={`p-1.5 rounded-lg ${notification.unread ? 'bg-primary/20 text-primary' : 'bg-white/5 text-gray-500'}`}>
                                    <IconBell size={14} />
                                  </div>
                                  <p className={`text-xs font-bold transition-colors ${notification.unread ? 'text-white' : 'text-gray-400'}`}>
                                    {notification.title}
                                  </p>
                                </div>
                                <span className="text-[10px] text-gray-500 font-medium bg-white/5 px-2 py-0.5 rounded-full">
                                  {new Date(notification.created_at).toLocaleDateString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              <p className="text-[11px] text-gray-400 leading-relaxed pl-8 group-hover:text-gray-300 transition-colors">
                                {notification.description}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-10 text-center">
                          <div className="w-16 h-16 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-center mx-auto mb-4 text-gray-700">
                            <IconBell size={28} />
                          </div>
                          <h4 className="text-sm font-medium text-gray-400 mb-1">Tudo limpo por aqui!</h4>
                          <p className="text-[11px] text-gray-500 max-w-[200px] mx-auto">Você não tem novas notificações no momento.</p>
                        </div>
                      )}
                    </div>

                    <div className="p-4 border-t border-white/10 bg-white/[0.01]">
                      <button
                        onClick={() => {
                          setNotificationsHistoryOpen(true);
                          setNotificationsOpen(false);
                        }}
                        className="w-full flex items-center justify-center space-x-2 py-2.5 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 text-[10px] font-bold text-gray-300 hover:text-white transition-all uppercase tracking-widest"
                      >
                        <span>Ver histórico completo</span>
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Help Icon */}
            <button
              className="text-gray-400 hover:text-white transition-all p-2 rounded-full border border-white/5 hover:bg-white/10 hover:border-white/20 w-[34px] h-[34px] flex items-center justify-center shrink-0"
              title="Ajuda e Suporte"
            >
              <IconHelpCircle size={18} stroke={1.5} />
            </button>

            {/* User Avatar & Menu */}
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="w-[38px] h-[38px] rounded-full ring-1 ring-white/10 bg-gradient-to-br from-primary to-accent flex items-center justify-center text-[10px] text-white font-bold shadow-[0_4px_12px_rgba(0,0,0,0.3)] shrink-0 hover:scale-105 transition-transform overflow-hidden"
              >
                {user?.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt="Profile"
                    className="w-full h-full object-cover select-none"
                    style={{ imageRendering: '-webkit-optimize-contrast' }}
                  />
                ) : (
                  user?.name.charAt(0) || 'A'
                )}
              </button>

              {/* User Dropdown Menu */}
              {userMenuOpen && (
                <>
                  <div className="fixed inset-0 z-[60]" onClick={() => setUserMenuOpen(false)}></div>
                  <div className="absolute right-0 top-full mt-2 w-72 border border-white/10 bg-[#161635]/95 backdrop-blur-md shadow-[0_10px_40px_rgba(0,0,0,0.7)] z-[70] rounded-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="p-4 border-b border-white/10">
                      <p className="text-sm font-bold text-white truncate">{user?.name}</p>
                      <p className="text-xs text-gray-400 truncate mb-1">{user?.email}</p>
                      {selectedCompany && (
                        <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">{selectedCompany.name}</p>
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

                    <div className="p-2">
                      <button onClick={() => openUserSettings('profile')} className="w-full flex items-center space-x-3 p-3 rounded-lg text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors">
                        <IconUser size={18} className="text-gray-500" />
                        <span>Meu Perfil</span>
                      </button>
                      <button onClick={() => openUserSettings('settings')} className="w-full flex items-center space-x-3 p-3 rounded-lg text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors">
                        <IconSettings size={18} className="text-gray-500" />
                        <span>Configurações</span>
                      </button>
                      <button onClick={() => logout()} className="w-full flex items-center space-x-3 p-3 rounded-lg text-sm text-red-400 hover:bg-red-500/5 transition-colors mt-1">
                        <IconLogout size={18} />
                        <span>Sair do Dashboard</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>
      )}

      {/* Main Body (Sidebar + Content) */}
      <div className="flex flex-1 overflow-hidden relative z-10">
        {/* Sidebar */}
        {layoutMode !== 'zen' && (
          <aside
            className={`relative z-20 flex flex-col transition-all duration-300 ${sidebarOpen ? 'w-56' : 'w-14'
              } glass-card border-r border-white/10 bg-[#0a0a1a]/80 backdrop-blur-md`}
          >
            {/* Navigation */}
            <nav className={`flex-1 overflow-y-auto py-4 ${sidebarOpen ? 'px-3' : 'px-2'} space-y-2 scrollbar-thin scrollbar-thumb-white/10`}>
              <NavItem to="/atividades" icon={<IconLayoutDashboard />} label="Atividades" expanded={sidebarOpen} />

              {/* Organizador with Submenu */}
              <div className="relative">
                <button
                  onClick={(e) => {
                    if (sidebarOpen) { toggleOrganizador(); }
                    else {
                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                      setFlyoutY(rect.top);
                      setFlyoutMenu(flyoutMenu === 'organizador' ? null : 'organizador');
                    }
                  }}
                  className={`w-full flex items-center ${sidebarOpen ? 'justify-between' : 'justify-center'} p-3 rounded-2xl transition-all duration-300 group ${location.pathname.includes('/organizador')
                    ? 'text-primary bg-primary/5 shadow-[0_4px_12px_rgba(0,0,0,0.1)]'
                    : 'text-gray-400 hover:bg-white/5 hover:text-white'
                    }`}
                >
                  <div className={`flex items-center ${sidebarOpen ? 'space-x-3' : 'justify-center'}`}>
                    <IconSubtask className={`w-5 h-5 transition-transform duration-300 group-hover:scale-110 ${location.pathname.includes('/organizador') ? 'text-primary' : ''}`} />
                    {sidebarOpen && <span className="font-medium">Organizador</span>}
                  </div>
                  {sidebarOpen && (
                    <div className="transition-transform duration-300">
                      {organizadorOpen ? <ChevronDown size={14} className="opacity-50" /> : <ChevronRight size={14} className="opacity-50" />}
                    </div>
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
                    <div className="fixed inset-0 z-[80]" onClick={() => setFlyoutMenu(null)}></div>
                    <div style={{ top: flyoutY - 44, left: '4.5rem' }} className="fixed w-52 bg-[#161635]/95 backdrop-blur-md border border-white/10 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.7)] z-[90] p-2 animate-in fade-in slide-in-from-left-2 duration-200">
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
                  onClick={(e) => {
                    if (sidebarOpen) { toggleFinanceiro(); }
                    else {
                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                      setFlyoutY(rect.top);
                      setFlyoutMenu(flyoutMenu === 'financeiro' ? null : 'financeiro');
                    }
                  }}
                  className={`w-full flex items-center ${sidebarOpen ? 'justify-between' : 'justify-center'} p-3 rounded-2xl transition-all duration-300 group ${location.pathname.includes('/financeiro')
                    ? 'text-primary bg-primary/5 shadow-[0_4px_12px_rgba(0,0,0,0.1)]'
                    : 'text-gray-400 hover:bg-white/5 hover:text-white'
                    }`}
                >
                  <div className={`flex items-center ${sidebarOpen ? 'space-x-3' : 'justify-center'}`}>
                    <IconCurrencyDollar className={`w-5 h-5 transition-transform duration-300 group-hover:scale-110 ${location.pathname.includes('/financeiro') ? 'text-primary' : ''}`} />
                    {sidebarOpen && <span className="font-medium">Financeiro</span>}
                  </div>
                  {sidebarOpen && (
                    <div className="transition-transform duration-300">
                      {financeiroOpen ? <ChevronDown size={14} className="opacity-50" /> : <ChevronRight size={14} className="opacity-50" />}
                    </div>
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
                    <div className="fixed inset-0 z-[80]" onClick={() => setFlyoutMenu(null)}></div>
                    <div style={{ top: flyoutY - 44, left: '4.5rem' }} className="fixed w-52 bg-[#161635]/95 backdrop-blur-md border border-white/10 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.7)] z-[90] p-2 animate-in fade-in slide-in-from-left-2 duration-200">
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
                  onClick={(e) => {
                    if (sidebarOpen) { toggleConfig(); }
                    else {
                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                      setFlyoutY(rect.top);
                      setFlyoutMenu(flyoutMenu === 'config' ? null : 'config');
                    }
                  }}
                  className={`w-full flex items-center ${sidebarOpen ? 'justify-between' : 'justify-center'} p-3 rounded-2xl transition-all duration-300 group ${location.pathname.includes('/configuracao')
                    ? 'text-primary bg-primary/5 shadow-[0_4px_12px_rgba(0,0,0,0.1)]'
                    : 'text-gray-400 hover:bg-white/5 hover:text-white'
                    }`}
                >
                  <div className={`flex items-center ${sidebarOpen ? 'space-x-3' : 'justify-center'}`}>
                    <IconSettings className={`w-5 h-5 transition-transform duration-300 group-hover:scale-110 ${location.pathname.includes('/configuracao') ? 'text-primary' : ''}`} />
                    {sidebarOpen && <span className="font-medium">Configuração</span>}
                  </div>
                  {sidebarOpen && (
                    <div className="transition-transform duration-300">
                      {configOpen ? <ChevronDown size={14} className="opacity-50" /> : <ChevronRight size={14} className="opacity-50" />}
                    </div>
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
                    <div className="fixed inset-0 z-[80]" onClick={() => setFlyoutMenu(null)}></div>
                    <div style={{ top: flyoutY - 44, left: '4.5rem' }} className="fixed w-52 bg-[#161635]/95 backdrop-blur-md border border-white/10 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.7)] z-[90] p-2 animate-in fade-in slide-in-from-left-2 duration-200">
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

        {/* Main Content Area */}
        <main className="flex-1 overflow-hidden relative flex flex-col">
          <div className="flex-1 overflow-y-auto p-4 md:p-8 scrollbar-thin scrollbar-thumb-white/10">
            <Outlet />
          </div>
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
        `flex items-center p-3 rounded-2xl transition-all duration-300 group relative ${expanded ? 'space-x-3' : 'justify-center'} ${isActive
          ? 'bg-primary/5 text-primary shadow-[0_4px_12px_rgba(0,0,0,0.1)]'
          : 'text-gray-400 hover:bg-white/5 hover:text-white hover:translate-x-1'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <div className={`transition-transform duration-300 group-hover:scale-110 ${isActive ? 'text-primary' : ''}`}>
            {React.cloneElement(icon as any, {
              className: `w-5 h-5`
            })}
          </div>
          {expanded && <span className="font-medium">{label}</span>}
        </>
      )}
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
