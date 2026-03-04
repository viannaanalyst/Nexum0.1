import React, { useState } from 'react';
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
  CheckSquare
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCompany } from '../context/CompanyContext';

const MainLayout = () => {
  const { user, logout } = useAuth();
  const { selectedCompany, selectCompany } = useCompany();
  const location = useLocation();
  const navigate = useNavigate();
  
  // Initialize closed by default, allow useEffect to open based on route
  const [configOpen, setConfigOpen] = useState(false);
  const [financeiroOpen, setFinanceiroOpen] = useState(false);
  const [organizadorOpen, setOrganizadorOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

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
                <SubNavItem to="/organizador/atividades" icon={<CheckSquare size={16} />} label="Atividades" />
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

        {/* User Profile / Footer */}
        <div className="p-4 border-t border-white/10">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold shadow-lg shadow-primary/30">
              {user?.name.charAt(0) || 'A'}
            </div>
            {sidebarOpen && (
              <div className="flex-1 overflow-hidden">
                <p className="text-sm font-medium truncate text-white">{user?.name}</p>
                <p className="text-xs text-gray-400 truncate">{user?.email}</p>
                {user?.role === 'SUPER ADMIN' && selectedCompany && (
                   <p className="text-xs text-primary truncate mt-1">
                     Gerenciando: {selectedCompany.name}
                   </p>
                )}
              </div>
            )}
            {sidebarOpen && (
              <button onClick={logout} className="text-gray-400 hover:text-white transition-colors">
                <LogOut size={18} />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col relative z-10 overflow-hidden">
        {/* Header */}
        <header className="h-20 glass-card border-b border-white/10 flex items-center justify-between px-8 bg-[#0a0a1a]/50 backdrop-blur-md">
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
          
          <div className="flex items-center space-x-6">
            <button className="relative text-gray-400 hover:text-white transition-colors">
              <Bell size={20} />
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>
            <div className="text-right hidden md:block">
              <p className="text-sm font-medium text-white">
                Olá, {user?.name}!
                {user?.role === 'SUPER ADMIN' && selectedCompany && (
                  <span className="block text-xs text-primary">Gerenciando: {selectedCompany.name}</span>
                )}
              </p>
              {!selectedCompany && <p className="text-xs text-gray-400 capitalize">{user?.role}</p>}
            </div>
          </div>
        </header>

        {/* Content Scrollable Area */}
        <main className="flex-1 overflow-y-auto p-8 scrollbar-thin scrollbar-thumb-white/10">
          <Outlet />
        </main>
      </div>
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
        {React.cloneElement(icon as React.ReactElement, { 
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
