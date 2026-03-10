import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CompanyProvider, useCompany } from './context/CompanyContext';
import { DashboardProvider } from './context/DashboardContext';
import Login from './pages/Login';
import MainLayout from './layouts/MainLayout';
import EmpresaConfig from './pages/Configuracao/Empresa';
import EquipeConfig from './pages/Configuracao/Equipe';
import RegrasFinanceiras from './pages/Configuracao/RegrasFinanceiras';
import Clientes from './pages/Configuracao/Clientes';
import Atividades from './pages/Atividades';
import SuperAdminDashboard from './pages/SuperAdmin/Dashboard';
import TrocarSenha from './pages/TrocarSenha';
import Calendario from './pages/Calendario';
import FinanceiroVisaoGeral from './pages/Financeiro/VisaoGeral';
import FinanceiroLancamentos from './pages/Financeiro/Lancamentos';
import FinanceiroComissoes from './pages/Financeiro/Comissoes';
import FinanceiroCobranca from './pages/Financeiro/Cobranca';
import OrganizadorKanban from './pages/Organizador/Kanban';
import OrganizadorLista from './pages/Organizador/Lista';
import OrganizadorAtividades from './pages/Organizador/Atividades';
import OrganizadorCronograma from './pages/Organizador/Cronograma';
import Suporte from './pages/Suporte';

// Component to protect routes based on authentication and roles
const ProtectedRoute = ({ children, allowedRoles }: { children: React.ReactNode, allowedRoles?: string[] }) => {
  const { user, isAuthenticated } = useAuth();
  const { selectedCompany, companies, selectCompany, loading } = useCompany();

  if (loading) {
    // return <div className="h-screen bg-[#0a0a1a] flex items-center justify-center text-white">Carregando...</div>;
    // Return null or a skeleton to prevent "flashing" a loading screen on small updates, 
    // or just render children if we trust the previous state.
    // But for initial load we need to block.
    // Let's just return nothing to avoid the flash if it's very fast, or keep the spinner if it's slow?
    // The "flash" is the spinner appearing and disappearing.
    // If we are already authenticated, we might want to show the app structure skeleton.
    return <div className="h-screen bg-[#0a0a1a]"></div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user?.role === 'SUPER ADMIN') {
    if (!selectedCompany) {
      return <Navigate to="/super-admin" replace />;
    }
  }

  // If user is NOT allowed for this specific route
  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    // Se for Super Admin, ele tem acesso a tudo, então essa checagem de allowedRoles 
    // deve considerar que Super Admin pode passar se 'SUPER ADMIN' não estiver na lista mas ele está "impersonando"
    // Mas a lógica atual é: se o papel do usuário não estiver na lista, bloqueia.
    // Vamos permitir Super Admin sempre se ele tiver selecionado uma empresa
    if (user.role !== 'SUPER ADMIN') {
      return <Navigate to="/" replace />;
    }
  }

  return <>{children}</>;
};

const PermissionLoading = () => (
  <div className="h-screen bg-[#0a0a1a] flex flex-col items-center justify-center text-white">
    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
    <p className="text-gray-400 animate-pulse">Carregando permissões...</p>
  </div>
);

const RedirectToAllowed = () => {
  const { user, loadingPermissions } = useAuth();
  
  if (loadingPermissions) return <PermissionLoading />;
  if (user?.is_super_admin) return <Navigate to="/atividades" replace />;
  if (!user?.permissions || Object.keys(user.permissions).length === 0) {
    return <div className="h-screen bg-[#0a0a1a] flex items-center justify-center text-white">Sem permissões atribuídas.</div>;
  }

  const priority = [
    'atividades', 'kanban', 'lista', 'cronograma', 'calendario', 
    'financeiro_geral', 'config_equipe', 'suporte'
  ];
  
  const allowed = priority.find(p => user.permissions![p] === true);
  
  if (allowed) {
    const routeMap: Record<string, string> = {
      atividades: '/atividades',
      kanban: '/organizador/kanban',
      lista: '/organizador/lista',
      cronograma: '/organizador/cronograma',
      calendario: '/calendario',
      financeiro_geral: '/financeiro/visao-geral',
      config_equipe: '/configuracao/equipe',
      suporte: '/suporte'
    };
    return <Navigate to={routeMap[allowed]} replace />;
  }

  return <div className="h-screen bg-[#0a0a1a] flex items-center justify-center text-white">Sem permissões atribuídas.</div>;
};

const PermissionGate = ({ children, permission }: { children: React.ReactNode, permission: string }) => {
  const { user, loadingPermissions } = useAuth();
  
  if (user?.is_super_admin) return <>{children}</>;
  if (loadingPermissions) return null;
  
  if (!user?.permissions || user.permissions[permission] !== true) {
    return <Navigate to="/" replace />;
  }
  
  return <>{children}</>;
};

const SuperAdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user?.role !== 'SUPER ADMIN') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function App() {
  console.log('App rendering');
  return (
    <BrowserRouter>
      <AuthProvider>
        <CompanyProvider>
          <DashboardProvider>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/trocar-senha" element={<TrocarSenha />} />

              <Route path="/super-admin" element={
                <SuperAdminRoute>
                  <SuperAdminDashboard />
                </SuperAdminRoute>
              } />

              <Route path="/" element={
                <ProtectedRoute allowedRoles={['admin', 'editor', 'visualizador', 'SUPER ADMIN']}>
                  <MainLayout />
                </ProtectedRoute>
              }>
                <Route index element={<RedirectToAllowed />} />
                <Route path="atividades" element={<PermissionGate permission="atividades"><Atividades /></PermissionGate>} />

                {/* Configuração Sub-routes */}
                <Route path="configuracao/empresa" element={<PermissionGate permission="config_empresa"><EmpresaConfig /></PermissionGate>} />
                <Route path="configuracao/regras-financeiras" element={<PermissionGate permission="config_regras"><RegrasFinanceiras /></PermissionGate>} />
                <Route path="configuracao/clientes" element={<PermissionGate permission="config_clientes"><Clientes /></PermissionGate>} />
                <Route path="configuracao/ia-automacao" element={<PermissionGate permission="config_ia"><div className="text-white p-8">IA e Automação (Em construção)</div></PermissionGate>} />
                <Route path="configuracao/equipe" element={<PermissionGate permission="config_equipe"><EquipeConfig /></PermissionGate>} />

                {/* Organizador Sub-routes */}
                <Route path="organizador" element={<Navigate to="/organizador/kanban" replace />} />
                <Route path="organizador/kanban" element={<PermissionGate permission="kanban"><OrganizadorKanban /></PermissionGate>} />
                <Route path="organizador/lista" element={<PermissionGate permission="lista"><OrganizadorLista /></PermissionGate>} />
                <Route path="organizador/historico" element={<PermissionGate permission="historico_tarefas"><OrganizadorAtividades /></PermissionGate>} />
                <Route path="organizador/cronograma" element={<PermissionGate permission="cronograma"><OrganizadorCronograma /></PermissionGate>} />

                {/* Other Sidebar Routes */}
                <Route path="relatorios" element={<PermissionGate permission="inteligencia_artificial"><div className="text-white p-8">Nexum Intelligence (Em construção)</div></PermissionGate>} />
                <Route path="calendario" element={<PermissionGate permission="calendario"><Calendario /></PermissionGate>} />
                <Route path="suporte" element={<PermissionGate permission="suporte"><Suporte /></PermissionGate>} />

                {/* Financeiro Sub-routes */}
                <Route path="financeiro" element={<Navigate to="/financeiro/visao-geral" replace />} />
                <Route path="financeiro/visao-geral" element={<PermissionGate permission="financeiro_geral"><FinanceiroVisaoGeral /></PermissionGate>} />
                <Route path="financeiro/lancamentos" element={<PermissionGate permission="financeiro_lancamentos"><FinanceiroLancamentos /></PermissionGate>} />
                <Route path="financeiro/comissoes" element={<PermissionGate permission="financeiro_comissoes"><FinanceiroComissoes /></PermissionGate>} />
                <Route path="financeiro/cobranca" element={<PermissionGate permission="financeiro_cobranca"><FinanceiroCobranca /></PermissionGate>} />
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </DashboardProvider>
        </CompanyProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
