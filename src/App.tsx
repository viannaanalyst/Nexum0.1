import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CompanyProvider, useCompany } from './context/CompanyContext';
import { DashboardProvider } from './context/DashboardContext';
import PageLoading from './components/PageLoading';

const Login = lazy(() => import('./pages/Login'));
import MainLayout from './layouts/MainLayout';
const EmpresaConfig = lazy(() => import('./pages/Configuracao/Empresa'));
const EquipeConfig = lazy(() => import('./pages/Configuracao/Equipe'));
const RegrasFinanceiras = lazy(() => import('./pages/Configuracao/RegrasFinanceiras'));
const Clientes = lazy(() => import('./pages/Configuracao/Clientes'));
const Atividades = lazy(() => import('./pages/Atividades'));
const SuperAdminDashboard = lazy(() => import('./pages/SuperAdmin/Dashboard'));
const TrocarSenha = lazy(() => import('./pages/TrocarSenha'));
const Calendario = lazy(() => import('./pages/Calendario'));
const FinanceiroVisaoGeral = lazy(() => import('./pages/Financeiro/VisaoGeral'));
const FinanceiroLancamentos = lazy(() => import('./pages/Financeiro/Lancamentos'));
const FinanceiroComissoes = lazy(() => import('./pages/Financeiro/Comissoes'));
const FinanceiroCobranca = lazy(() => import('./pages/Financeiro/Cobranca'));
const OrganizadorKanban = lazy(() => import('./pages/Organizador/Kanban'));
const OrganizadorLista = lazy(() => import('./pages/Organizador/Lista'));
const OrganizadorAtividades = lazy(() => import('./pages/Organizador/Atividades'));
const OrganizadorCronograma = lazy(() => import('./pages/Organizador/Cronograma'));
const Suporte = lazy(() => import('./pages/Suporte'));

// Component to protect routes based on authentication and roles
const ProtectedRoute = ({ children, allowedRoles }: { children: React.ReactNode, allowedRoles?: string[] }) => {
  const { user, isAuthenticated } = useAuth();
  const { selectedCompany, companies, selectCompany, loading } = useCompany();

  if (loading) {
    return <PageLoading />;
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
              <Route path="/login" element={<Suspense fallback={<PageLoading />}><Login /></Suspense>} />
              <Route path="/trocar-senha" element={<Suspense fallback={<PageLoading />}><TrocarSenha /></Suspense>} />

              <Route path="/super-admin" element={
                <Suspense fallback={<PageLoading />}>
                  <SuperAdminRoute>
                    <SuperAdminDashboard />
                  </SuperAdminRoute>
                </Suspense>
              } />

              <Route path="/" element={
                <ProtectedRoute allowedRoles={['admin', 'editor', 'visualizador', 'SUPER ADMIN']}>
                  <MainLayout />
                </ProtectedRoute>
              }>
                <Route index element={<RedirectToAllowed />} />
                <Route path="atividades" element={<Suspense fallback={<PageLoading />}><PermissionGate permission="atividades"><Atividades /></PermissionGate></Suspense>} />

                {/* Configuração Sub-routes */}
                <Route path="configuracao/empresa" element={<Suspense fallback={<PageLoading />}><PermissionGate permission="config_empresa"><EmpresaConfig /></PermissionGate></Suspense>} />
                <Route path="configuracao/regras-financeiras" element={<Suspense fallback={<PageLoading />}><PermissionGate permission="config_regras"><RegrasFinanceiras /></PermissionGate></Suspense>} />
                <Route path="configuracao/clientes" element={<Suspense fallback={<PageLoading />}><PermissionGate permission="config_clientes"><Clientes /></PermissionGate></Suspense>} />
                <Route path="configuracao/ia-automacao" element={<PermissionGate permission="config_ia"><div className="text-white p-8">IA e Automação (Em construção)</div></PermissionGate>} />
                <Route path="configuracao/equipe" element={<Suspense fallback={<PageLoading />}><PermissionGate permission="config_equipe"><EquipeConfig /></PermissionGate></Suspense>} />

                {/* Organizador Sub-routes */}
                <Route path="organizador" element={<Navigate to="/organizador/kanban" replace />} />
                <Route path="organizador/kanban" element={<Suspense fallback={<PageLoading />}><PermissionGate permission="kanban"><OrganizadorKanban /></PermissionGate></Suspense>} />
                <Route path="organizador/lista" element={<Suspense fallback={<PageLoading />}><PermissionGate permission="lista"><OrganizadorLista /></PermissionGate></Suspense>} />
                <Route path="organizador/historico" element={<Suspense fallback={<PageLoading />}><PermissionGate permission="historico_tarefas"><OrganizadorAtividades /></PermissionGate></Suspense>} />
                <Route path="organizador/cronograma" element={<Suspense fallback={<PageLoading />}><PermissionGate permission="cronograma"><OrganizadorCronograma /></PermissionGate></Suspense>} />

                {/* Other Sidebar Routes */}
                <Route path="relatorios" element={<PermissionGate permission="inteligencia_artificial"><div className="text-white p-8">Nexum Intelligence (Em construção)</div></PermissionGate>} />
                <Route path="calendario" element={<Suspense fallback={<PageLoading />}><PermissionGate permission="calendario"><Calendario /></PermissionGate></Suspense>} />
                <Route path="suporte" element={<Suspense fallback={<PageLoading />}><PermissionGate permission="suporte"><Suporte /></PermissionGate></Suspense>} />

                {/* Financeiro Sub-routes */}
                <Route path="financeiro" element={<Navigate to="/financeiro/visao-geral" replace />} />
                <Route path="financeiro/visao-geral" element={<Suspense fallback={<PageLoading />}><PermissionGate permission="financeiro_geral"><FinanceiroVisaoGeral /></PermissionGate></Suspense>} />
                <Route path="financeiro/lancamentos" element={<Suspense fallback={<PageLoading />}><PermissionGate permission="financeiro_lancamentos"><FinanceiroLancamentos /></PermissionGate></Suspense>} />
                <Route path="financeiro/comissoes" element={<Suspense fallback={<PageLoading />}><PermissionGate permission="financeiro_comissoes"><FinanceiroComissoes /></PermissionGate></Suspense>} />
                <Route path="financeiro/cobranca" element={<Suspense fallback={<PageLoading />}><PermissionGate permission="financeiro_cobranca"><FinanceiroCobranca /></PermissionGate></Suspense>} />
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
